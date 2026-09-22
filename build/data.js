var STAGES = [{
  id: "ncnda",
  label: "NCNDA",
  prob: 0.10
}, {
  id: "intro_partner",
  label: "Intro to Partner",
  prob: 0.25
}, {
  id: "intro_call",
  label: "Intro Call",
  prob: 0.40
}, {
  id: "quote",
  label: "Quote",
  prob: 0.55
}, {
  id: "negotiate",
  label: "Negotiate",
  prob: 0.75
}, {
  id: "won",
  label: "Closed Won",
  prob: 1.0
}, {
  id: "lost",
  label: "Closed Lost",
  prob: 0
}];
var STAGE_ALIAS = {
  prospect: "ncnda",
  discovery: "intro_call",
  proposal: "quote",
  negotiation: "negotiate",
  qualification: "intro_call",
  closing: "negotiate"
};
window.cnNormalizeStage = function (id) {
  if (!id) return "ncnda";
  if (STAGES.some(s => s.id === id)) return id;
  return STAGE_ALIAS[id] || id;
};
window.REPS = window.REPS || [];
window.STAGES = STAGES;