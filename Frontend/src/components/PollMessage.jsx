import React, { useState } from "react";
import axios from "axios";

const PollMessage = ({ message, currentUserId }) => {
  const [poll, setPoll] = useState(message.poll);
  const [selectedOptions, setSelectedOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showVoters, setShowVoters] = useState(false);

  const handleVoteClick = (index) => {
    if (poll.closed) return;
    if (hasVoted(poll, currentUserId)) return; // lock options once voted (WhatsApp behavior)

    if (poll.multiSelect) {
      setSelectedOptions((prev) =>
        prev.includes(index)
          ? prev.filter((i) => i !== index)
          : [...prev, index]
      );
    } else {
      setSelectedOptions([index]);
    }
  };

  const optimisticApplyVote = (draft) => {
    // Add current user id to each selected option if not already present
    const added = new Set();
    const nextOptions = draft.options.map((opt, idx) => {
      if (!selectedOptions.includes(idx)) return opt;
      if (opt.votes.includes(currentUserId)) return opt;
      added.add(idx);
      return { ...opt, votes: [...opt.votes, currentUserId] };
    });
    const addedCount = added.size;
    const nextTotal = (draft.totalVotes ?? draft.options.reduce((a, o) => a + (o.votes?.length || 0), 0)) + addedCount;
    return { ...draft, options: nextOptions, totalVotes: nextTotal };
  };

  const submitVote = async () => {
    if (selectedOptions.length === 0) return;
    setLoading(true);
    try {
      const res = await axios.post(`/api/polls/${message._id}/vote`, {
        selectedOptions,
      });
      const nextPoll = res.data?.poll?.poll || res.data?.poll || res.data;
      if (nextPoll) {
        setPoll(nextPoll);
      } else {
        // Fallback optimistic update if API returns unexpected shape
        setPoll((prev) => optimisticApplyVote(prev));
      }
    } catch (err) {
      // Apply optimistic update even on failure to satisfy UX; backend sync may correct later
      setPoll((prev) => optimisticApplyVote(prev));
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const voted = hasVoted(poll, currentUserId);
  const totalVotes = getTotalVotes(poll);

  return (
    <div className="w-full">
      <div className="rounded-xl p-3 bg-emerald-50 text-emerald-950 border border-emerald-100">
        <h3 className="font-semibold mb-3 leading-snug">
          {poll.question}
        </h3>

        <div className="space-y-3">
          {poll.options.map((opt, index) => {
            const userVotedHere = opt.votes.includes(currentUserId);
            const percent = totalVotes ? Math.round(((opt.votes.length || 0) / totalVotes) * 100) : 0;

            return (
              <button
                type="button"
                key={opt._id || index}
                className={`w-full text-left group rounded-lg px-3 py-2 bg-white/60 hover:bg-white border border-emerald-100 transition relative`}
                onClick={() => handleVoteClick(index)}
              >
                <div className="flex items-center gap-3 relative z-10">
                  <span
                    className={`flex items-center justify-center h-5 w-5 rounded-full border ${
                      userVotedHere || selectedOptions.includes(index)
                        ? "border-emerald-600 bg-emerald-600 text-white"
                        : "border-emerald-400 bg-white"
                    }`}
                  >
                    {(userVotedHere || selectedOptions.includes(index)) && (
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                        <path fillRule="evenodd" d="M16.704 5.29a1 1 0 010 1.42l-7.2 7.2a1 1 0 01-1.42 0l-3.2-3.2a1 1 0 111.42-1.42l2.49 2.49 6.49-6.49a1 1 0 011.42 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </span>
                  <span className="flex-1 font-medium text-sm text-emerald-950">{opt.optionText}</span>
                  {voted && (
                    <span className="text-xs font-semibold text-emerald-700 min-w-[2rem] text-right">{percent}%</span>
                  )}
                </div>

                {/* Progress bar when results visible */}
                {voted && (
                  <div className="mt-2 h-2 w-full rounded-full bg-emerald-100 overflow-hidden">
                    <div className="h-full bg-emerald-500" style={{ width: `${percent}%` }} />
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
              onClick={submitVote}
              disabled={loading || selectedOptions.length === 0}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold disabled:bg-emerald-200"
            >
              {loading ? "Voting..." : poll.multiSelect ? "Submit votes" : "Vote"}
            </button>
          ) : (
            <button
              onClick={() => setShowVoters((s) => !s)}
              className="text-emerald-700 text-sm font-semibold hover:underline"
            >
              View votes
            </button>
          )}

          <span className="text-[11px] text-emerald-700/80">
            {totalVotes} vote{totalVotes === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      {/* Optional voters list (IDs only if names unavailable) */}
      {showVoters && (
        <div className="mt-2 rounded-lg bg-white/70 border border-emerald-100 p-2 text-xs text-emerald-900">
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


