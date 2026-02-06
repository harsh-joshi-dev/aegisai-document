import ChatUI from '../../components/ChatUI';

export default function MobileChat() {
  return (
    <div>
      <div className="m-page-title">
        <h1>Chat</h1>
      </div>
      <div className="m-chat-wrapper">
        <ChatUI />
      </div>
    </div>
  );
}
