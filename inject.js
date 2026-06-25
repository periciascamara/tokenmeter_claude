// Claude.ai TokenMeter MAIN World Interceptor
(function() {
  // Self-contained token estimator for the page context (no external dependencies allowed in page context)
  function estimateTokensLocal(text) {
    if (!text || typeof text !== 'string') return 0;
    const charCount = text.length;
    const words = text.trim().split(/\s+/);
    const wordCount = words.length === 1 && words[0] === '' ? 0 : words.length;
    const specialChars = (text.match(/[{}[\]()\;.,+=<>!&|?~`\-*\/%^:\n]/g) || []).length;
    const estimate = Math.ceil(Math.max(
      charCount / 3.8,
      wordCount * 1.3 + specialChars * 0.5
    ));
    return Math.max(1, estimate);
  }

  // Helper to extract tokens from a conversation object
  function parseConversationTokens(chat) {
    let input = 0;
    let output = 0;
    let model = 'claude-3-5-sonnet';

    if (chat && chat.chat_messages) {
      chat.chat_messages.forEach(msg => {
        let textTokens = estimateTokensLocal(msg.text || '');
        
        // Include attachments token count if present
        let attachmentsTokens = 0;
        if (msg.attachments && Array.isArray(msg.attachments)) {
          msg.attachments.forEach(att => {
            if (att.extracted_content) {
              attachmentsTokens += estimateTokensLocal(att.extracted_content);
            }
          });
        }

        const totalMsgTokens = textTokens + attachmentsTokens;

        if (msg.sender === 'human') {
          input += totalMsgTokens;
        } else if (msg.sender === 'assistant') {
          output += totalMsgTokens;
          if (msg.model) {
            model = msg.model;
          }
        }
      });
    }

    return {
      input,
      output,
      total: input + output,
      model
    };
  }

  const originalFetch = window.fetch;

  window.fetch = async function(...args) {
    const url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url);
    const options = args[1];

    // Intercept completion requests (POST requests)
    if (url && url.includes('/completion')) {
      let model = 'claude-3-5-sonnet';
      let promptTokens = 0;
      let conversationUuid = '';

      if (options && options.body) {
        try {
          const bodyObj = JSON.parse(options.body);
          if (bodyObj.model) model = bodyObj.model;
          conversationUuid = bodyObj.conversation_uuid;
          
          // Estimate prompt tokens (text + attachments)
          let promptText = bodyObj.prompt || '';
          let attsTokens = 0;
          if (bodyObj.attachments && Array.isArray(bodyObj.attachments)) {
            bodyObj.attachments.forEach(att => {
              if (att.extracted_content) {
                attsTokens += estimateTokensLocal(att.extracted_content);
              }
            });
          }
          promptTokens = estimateTokensLocal(promptText) + attsTokens;
        } catch (e) {
          console.error('[TokenMeter] Interceptor error parsing request body', e);
        }
      }

      // Execute original fetch
      const response = await originalFetch(...args);

      if (response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let completionText = '';

        const newStream = new ReadableStream({
          async start(controller) {
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) {
                  const outputTokens = estimateTokensLocal(completionText);
                  
                  // Send message that completion finished, with exact calculated tokens to add to weekly & session state
                  window.postMessage({
                    type: 'CLAUDE_COMPLETION_FINISHED',
                    data: {
                      inputTokens: promptTokens,
                      outputTokens: outputTokens,
                      model,
                      conversationUuid
                    }
                  }, '*');

                  controller.close();
                  break;
                }

                // Enqueue to let the Claude UI read the stream unmodified
                controller.enqueue(value);

                // Decode and accumulate streamed text
                const chunkStr = decoder.decode(value, { stream: true });
                const lines = chunkStr.split('\n');
                
                for (const line of lines) {
                  if (line.startsWith('data:')) {
                    const dataStr = line.slice(5).trim();
                    if (dataStr) {
                      try {
                        const parsed = JSON.parse(dataStr);
                        if (parsed.completion) {
                          completionText += parsed.completion;
                        } else if (parsed.type === 'completion' && parsed.completion) {
                          completionText += parsed.completion;
                        }
                      } catch (e) {}
                    }
                  }
                }
              }
            } catch (err) {
              controller.error(err);
            }
          }
        });

        // Return the custom readable stream wrapped in a Response object
        return new Response(newStream, {
          headers: response.headers,
          status: response.status,
          statusText: response.statusText
        });
      }

      return response;
    }

    // Process other GET requests
    const response = await originalFetch(...args);

    if (url) {
      // 1. Intercept user details
      if (url.includes('/api/me')) {
        const clone = response.clone();
        clone.json().then(data => {
          if (data) {
            window.postMessage({
              type: 'CLAUDE_ME_RECEIVED',
              data: {
                email: data.email_address || '',
                name: (data.profile && data.profile.name) || 'Claude User',
                photoUrl: (data.profile && data.profile.photo_url) || ''
              }
            }, '*');
          }
        }).catch(() => {});
      }
      
      // 2. Intercept organizations (for plan information)
      else if (url.includes('/api/organizations') && !url.includes('/chat_conversations')) {
        const clone = response.clone();
        clone.json().then(data => {
          if (Array.isArray(data) && data.length > 0) {
            const org = data[0];
            let plan = 'Free Plan';
            
            // Heuristic for plan detection from capabilities or active flags
            if (org.active_flags && Array.isArray(org.active_flags)) {
              if (org.active_flags.includes('pro') || org.active_flags.includes('claude_pro')) {
                plan = 'Claude Pro';
              } else if (org.active_flags.includes('team') || org.active_flags.includes('claude_team')) {
                plan = 'Claude Team';
              }
            } else if (org.capabilities && Array.isArray(org.capabilities)) {
              if (org.capabilities.includes('pro_tier')) {
                plan = 'Claude Pro';
              }
            }

            window.postMessage({
              type: 'CLAUDE_ORG_RECEIVED',
              data: {
                orgName: org.name || 'Organization',
                plan
              }
            }, '*');
          }
        }).catch(() => {});
      }
      
      // 3. Intercept switching / loading chats to calculate session context tokens
      else if (url.includes('/chat_conversations/') && !url.includes('/completion')) {
        const clone = response.clone();
        clone.json().then(data => {
          if (data && data.uuid) {
            const parsed = parseConversationTokens(data);
            window.postMessage({
              type: 'CLAUDE_CHAT_LOADED',
              data: {
                conversationUuid: data.uuid,
                sessionTokens: {
                  input: parsed.input,
                  output: parsed.output,
                  total: parsed.total
                },
                model: parsed.model
              }
            }, '*');
          }
        }).catch(() => {});
      }

      // 4. Intercept Claude's native usage limits endpoint
      else if (url.includes('/usage') && !url.includes('/completion')) {
        const clone = response.clone();
        clone.json().then(data => {
          if (data) {
            window.postMessage({
              type: 'CLAUDE_USAGE_RECEIVED',
              data: data
            }, '*');
          }
        }).catch(() => {});
      }
    }

    return response;
  };

  // Proactively fetch profile and organizations to populate initial state instantly
  function proactiveFetch() {
    originalFetch('/api/me')
      .then(res => {
        if (!res.ok) throw new Error('Not authenticated');
        return res.json();
      })
      .then(data => {
        if (data) {
          window.postMessage({
            type: 'CLAUDE_ME_RECEIVED',
            data: {
              email: data.email_address || '',
              name: (data.profile && data.profile.name) || 'Claude User',
              photoUrl: (data.profile && data.profile.photo_url) || ''
            }
          }, '*');
        }
      }).catch(e => console.log('[TokenMeter] Proactive /api/me failed:', e));

    originalFetch('/api/organizations')
      .then(res => res.json())
      .then(orgs => {
        if (Array.isArray(orgs) && orgs.length > 0) {
          const org = orgs[0];
          let plan = 'Free Plan';
          
          if (org.active_flags && Array.isArray(org.active_flags)) {
            if (org.active_flags.includes('pro') || org.active_flags.includes('claude_pro')) {
              plan = 'Claude Pro';
            } else if (org.active_flags.includes('team') || org.active_flags.includes('claude_team')) {
              plan = 'Claude Team';
            }
          } else if (org.capabilities && Array.isArray(org.capabilities)) {
            if (org.capabilities.includes('pro_tier')) {
              plan = 'Claude Pro';
            }
          }

          window.postMessage({
            type: 'CLAUDE_ORG_RECEIVED',
            data: {
              orgName: org.name || 'Organization',
              plan
            }
          }, '*');

          // Fetch usage limits as well!
          originalFetch(`/api/organizations/${org.uuid}/usage`)
            .then(res => res.json())
            .then(usageData => {
              window.postMessage({
                type: 'CLAUDE_USAGE_RECEIVED',
                data: usageData
              }, '*');
            }).catch(e => console.log('[TokenMeter] Proactive /usage failed:', e));
        }
      }).catch(e => console.log('[TokenMeter] Proactive /api/organizations failed:', e));
  }

  // Trigger proactive fetch after a short delay
  setTimeout(proactiveFetch, 1500);
})();

