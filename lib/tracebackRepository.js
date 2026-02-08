// Firestore repository for traceback collection

const { initFirebase } = require("./firebase");

// Save one analysis document in traceback collection
async function saveTraceback(analysisDoc) {
  const db = initFirebase();
  const collection = db.collection("traceback");
  const result = await collection.add(analysisDoc);
  return result.id;
}

// Get all traceback documents
async function getAllTracebacks() {
  const db = initFirebase();
  const collection = db.collection("traceback");
  const snapshot = await collection.orderBy("sentAt", "desc").get();
  
  const documents = [];
  snapshot.forEach((doc) => {
    documents.push({
      id: doc.id,
      ...doc.data(),
    });
  });
  
  return documents;
}

// Search tracebacks by criteria
async function searchTracebacks(searchParams) {
  const allDocs = await getAllTracebacks();
  
  const { target_action, target_objects, target_location, time_context } = searchParams;
  
  // Score-based matching
  const scoredResults = allDocs.map((doc) => {
    let score = 0;
    const matches = [];
    
    const analysis = doc.analysis || {};
    
    // Match action
    if (target_action && analysis.action) {
      const actionLower = analysis.action.toLowerCase();
      const targetLower = target_action.toLowerCase();
      if (actionLower.includes(targetLower) || targetLower.includes(actionLower)) {
        score += 3;
        matches.push("action");
      }
    }
    
    // Match objects
    if (target_objects && target_objects.length > 0 && analysis.objects) {
      const docObjects = analysis.objects.map(o => o.toLowerCase());
      for (const targetObj of target_objects) {
        const targetLower = targetObj.toLowerCase();
        for (const docObj of docObjects) {
          if (docObj.includes(targetLower) || targetLower.includes(docObj)) {
            score += 2;
            matches.push(`object:${targetObj}`);
            break;
          }
        }
      }
    }
    
    // Match location
    if (target_location && analysis.location) {
      const locationLower = analysis.location.toLowerCase();
      const targetLower = target_location.toLowerCase();
      if (locationLower.includes(targetLower) || targetLower.includes(locationLower)) {
        score += 1;
        matches.push("location");
      }
    }
    
    return { doc, score, matches };
  });
  
  // Filter and sort by score
  const results = scoredResults
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);
  
  return results;
}

module.exports = { saveTraceback, getAllTracebacks, searchTracebacks };
