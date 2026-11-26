import { useState } from "react";
import { apiFetch, readApiJson } from "../lib/apiFetch";

const PollMessage = ({ message, currentUserId }) => {
  const [poll, setPoll] = useState(message.poll);
  const [selectedOptions, setSelectedOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showVoters, setShowVoters] = useState(false);

  const handleVoteClick = (index) => {
    if (poll.closed || loading) return;
    if (hasVoted(poll, currentUserId)) return; // lock options once voted (WhatsApp behavior)

    if (poll.multiSelect) {
      setSelectedOptions((prev) =>
        prev.includes(index)
          ? prev.filter((i) => i !== index)
          : [...prev, index]
      );
    } else {
      // Single-select: tap submits immediately (WhatsApp-like)
      setSelectedOptions([index]);
      submitVote([index]);
    }
  };

  const submitVote = async (indexesOverride) => {
    const indexes = Array.isArray(indexesOverride) ? indexesOverride : selectedOptions;
    if (!indexes || indexes.length === 0 || loading) return;
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch(`/api/polls/${message._id}/vote`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectedOptions: indexes }),
      });
      const data = await readApiJson(res);
      if (!res.ok) throw new Error(data.message || "Could not record your vote.");
      const nextPoll = data.poll?.poll || data.poll;
      if (nextPoll) {
        setPoll(nextPoll);
      }
    } catch (err) {
      setError(err.message || "Could not record your vote. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const voted = hasVoted(poll, currentUserId);
  const totalVotes = getTotalVotes(poll);

  return (
    <div className="w-full">
      <div className="chat-poll rounded-xl p-3">
        <h3 className="font-semibold mb-3 leading-snug">
          {poll.question}
        </h3>

        {error && <p role="alert" className="chat-poll-error mb-2 text-sm">{error}</p>}
        <div className="space-y-3">
          {poll.options.map((opt, index) => {
            const userVotedHere = opt.votes.includes(currentUserId);
            const percent = totalVotes ? Math.round(((opt.votes.length || 0) / totalVotes) * 100) : 0;

            return (
              <button
                type="button"
                key={opt._id || index}
                className="chat-poll-option w-full text-left rounded-lg px-3 py-2"
                onClick={() => handleVoteClick(index)}
              >
                <div className="flex items-center gap-3 relative z-10">
                  <span
                    className="chat-poll-check flex items-center justify-center h-5 w-5 rounded-full"
                    data-checked={userVotedHere || selectedOptions.includes(index)}
                  >
                    {(userVotedHere || selectedOptions.includes(index)) && (
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                        <path fillRule="evenodd" d="M16.704 5.29a1 1 0 010 1.42l-7.2 7.2a1 1 0 01-1.42 0l-3.2-3.2a1 1 0 111.42-1.42l2.49 2.49 6.49-6.49a1 1 0 011.42 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </span>
                  <span className="flex-1 font-medium text-sm">{opt.optionText}</span>
                  {voted && (
                    <span className="chat-poll-meta text-xs font-semibold min-w-[2rem] text-right">{percent}%</span>
                  )}
                </div>

                {/* Progress bar when results visible */}
                {voted && (
                  <div className="chat-poll-track mt-2 h-1 w-full rounded-full overflow-hidden">
                    <div className="chat-poll-fill h-full" style={{ width: `${percent}%` }} />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Action / Meta */}
        <div className="mt-3 flex items-center justify-between">
          {!voted && !poll.closed ? (
            <button
              onClick={() => submitVote()}
              disabled={loading || (!poll.multiSelect && selectedOptions.length === 0) || (poll.multiSelect && selectedOptions.length === 0)}
              className={`chat-poll-submit px-3 py-1.5 rounded-lg text-sm font-semibold${poll.multiSelect ? "" : " hidden"}`}
            >
              {loading ? "Voting..." : poll.multiSelect ? "Submit votes" : "Vote"}
            </button>
          ) : (
            <button
              onClick={() => setShowVoters((s) => !s)}
              className="chat-poll-meta text-sm font-semibold hover:underline"
            >
              View votes
            </button>
          )}

          <span className="chat-poll-meta text-[11px]">
            {totalVotes} vote{totalVotes === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      {/* Optional voters list (IDs only if names unavailable) */}
      {showVoters && (
        <div className="chat-poll mt-2 rounded-lg p-2 text-xs">
          {poll.options.map((opt, idx) => (
            <div key={opt._id || idx} className="flex items-start gap-2 py-1">
              <span className="min-w-[10ch] font-medium">{opt.optionText}:</span>
              <span className="opacity-80">{opt.votes.length} vote{opt.votes.length === 1 ? "" : "s"}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

function hasVoted(poll, userId) {
  return poll.options.some((opt) => opt.votes.includes(userId));
}

function getTotalVotes(poll) {
  return poll.totalVotes ?? poll.options.reduce((acc, o) => acc + (o.votes?.length || 0), 0);
}

export default PollMessage;


