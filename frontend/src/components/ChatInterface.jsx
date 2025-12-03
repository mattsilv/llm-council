import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import Stage1 from './Stage1';
import Stage2 from './Stage2';
import Stage3 from './Stage3';
import './ChatInterface.css';

export default function ChatInterface({
  conversation,
  onSendMessage,
  isLoading,
}) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [conversation]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      onSendMessage(input);
      setInput('');
    }
  };

  const handleKeyDown = (e) => {
    // Submit on Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const generateMarkdown = () => {
    if (!conversation || conversation.messages.length === 0) return '';

    let md = `# LLM Council Deliberation\n\n`;
    md += `**Title:** ${conversation.title || 'Untitled'}\n`;
    md += `**Date:** ${new Date(conversation.created_at).toLocaleString()}\n\n`;
    md += `---\n\n`;

    conversation.messages.forEach((msg, index) => {
      if (msg.role === 'user') {
        md += `## User Query\n\n${msg.content}\n\n`;
      } else {
        // Stage 1
        if (msg.stage1) {
          md += `## Stage 1: Individual Responses\n\n`;
          msg.stage1.forEach((resp) => {
            const modelName = resp.model.split('/')[1] || resp.model;
            md += `### ${modelName}\n\n${resp.response}\n\n`;
          });
        }

        // Stage 2
        if (msg.stage2) {
          md += `## Stage 2: Peer Rankings\n\n`;
          if (msg.metadata?.aggregate_rankings) {
            md += `### Aggregate Rankings\n\n`;
            msg.metadata.aggregate_rankings.forEach((r, i) => {
              md += `${i + 1}. **${r.model.split('/')[1] || r.model}** (avg rank: ${r.average_rank.toFixed(2)})\n`;
            });
            md += `\n`;
          }
          msg.stage2.forEach((ranking) => {
            const modelName = ranking.model.split('/')[1] || ranking.model;
            md += `### Evaluation by ${modelName}\n\n${ranking.ranking}\n\n`;
          });
        }

        // Stage 3
        if (msg.stage3) {
          md += `## Stage 3: Final Council Answer\n\n`;
          const chairmanName = msg.stage3.model.split('/')[1] || msg.stage3.model;
          md += `**Chairman:** ${chairmanName}\n\n`;
          md += `${msg.stage3.response}\n\n`;
        }

        md += `---\n\n`;
      }
    });

    return md;
  };

  const handleDownload = () => {
    const markdown = generateMarkdown();
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const title = conversation?.title?.replace(/[^a-z0-9]/gi, '-').toLowerCase() || 'council-deliberation';
    a.download = `${title}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!conversation) {
    return (
      <div className="chat-interface">
        <div className="empty-state">
          <h2>Welcome to LLM Council</h2>
          <p>Create a new conversation to get started</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-interface">
      <div className="messages-container">
        {conversation.messages.length === 0 ? (
          <div className="empty-state">
            <h2>Start a conversation</h2>
            <p>Ask a question to consult the LLM Council</p>
          </div>
        ) : (
          conversation.messages.map((msg, index) => (
            <div key={index} className="message-group">
              {msg.role === 'user' ? (
                <div className="user-message">
                  <div className="message-label">You</div>
                  <div className="message-content">
                    <div className="markdown-content">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="assistant-message">
                  <div className="message-label">LLM Council</div>

                  {/* Stage 1 */}
                  {msg.loading?.stage1 && (
                    <div className="stage-loading">
                      <div className="spinner"></div>
                      <span>Running Stage 1: Collecting individual responses...</span>
                    </div>
                  )}
                  {msg.stage1 && <Stage1 responses={msg.stage1} />}

                  {/* Stage 2 */}
                  {msg.loading?.stage2 && (
                    <div className="stage-loading">
                      <div className="spinner"></div>
                      <span>Running Stage 2: Peer rankings...</span>
                    </div>
                  )}
                  {msg.stage2 && (
                    <Stage2
                      rankings={msg.stage2}
                      labelToModel={msg.metadata?.label_to_model}
                      aggregateRankings={msg.metadata?.aggregate_rankings}
                    />
                  )}

                  {/* Stage 3 */}
                  {msg.loading?.stage3 && (
                    <div className="stage-loading">
                      <div className="spinner"></div>
                      <span>Running Stage 3: Final synthesis...</span>
                    </div>
                  )}
                  {msg.stage3 && <Stage3 finalResponse={msg.stage3} />}
                </div>
              )}
            </div>
          ))
        )}

        {isLoading && (
          <div className="loading-indicator">
            <div className="spinner"></div>
            <span>Consulting the council...</span>
          </div>
        )}

        {conversation.messages.length > 0 && !isLoading && (
          <div className="download-section">
            <button className="download-button" onClick={handleDownload}>
              📥 Download as Markdown
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {conversation.messages.length === 0 && (
        <form className="input-form" onSubmit={handleSubmit}>
          <textarea
            className="message-input"
            placeholder="Ask your question... (Shift+Enter for new line, Enter to send)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            rows={3}
          />
          <button
            type="submit"
            className="send-button"
            disabled={!input.trim() || isLoading}
          >
            Send
          </button>
        </form>
      )}
    </div>
  );
}
