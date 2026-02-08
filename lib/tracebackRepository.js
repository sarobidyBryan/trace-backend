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
    
    // Match actions (now an array)
    if (target_action && analysis.actions && analysis.actions.length > 0) {
      const targetLower = target_action.toLowerCase();
      for (const action of analysis.actions) {
        const actionLower = action.toLowerCase();
        if (actionLower.includes(targetLower) || targetLower.includes(actionLower)) {
          score += 3;
          matches.push("action");
          break;
        }
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
    
    // Match tags for broader search
    if (target_objects && target_objects.length > 0 && analysis.tags) {
      const docTags = analysis.tags.map(t => t.toLowerCase());
      for (const targetObj of target_objects) {
        const targetLower = targetObj.toLowerCase();
        for (const tag of docTags) {
          if (tag.includes(targetLower) || targetLower.includes(tag)) {
            score += 1;
            matches.push(`tag:${targetObj}`);
            break;
          }
        }
      }
    }
    
    // Match locations (now an array)
    if (target_location && analysis.locations && analysis.locations.length > 0) {
      const targetLower = target_location.toLowerCase();
      for (const location of analysis.locations) {
        const locationLower = location.toLowerCase();
        if (locationLower.includes(targetLower) || targetLower.includes(locationLower)) {
          score += 1;
          matches.push("location");
          break;
        }
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
