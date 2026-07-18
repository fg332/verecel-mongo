// --- DOM Elements ---
const connInput = document.getElementById('connectionString');
const toggleConnBtn = document.getElementById('toggle-conn-str');
const dbInput = document.getElementById('dbName');
const colInput = document.getElementById('collectionName');
const actionSelect = document.getElementById('actionSelect');
const mongoForm = document.getElementById('mongo-form');

// Textareas & Groups
const groupQuery = document.getElementById('group-query');
const groupDocument = document.getElementById('group-document');
const groupDocuments = document.getElementById('group-documents');
const groupUpdate = document.getElementById('group-update');
const groupOptions = document.getElementById('group-options');

const queryInput = document.getElementById('queryInput');
const documentInput = document.getElementById('documentInput');
const documentsInput = document.getElementById('documentsInput');
const updateInput = document.getElementById('updateInput');
const optionsInput = document.getElementById('optionsInput');

// Console Metrics & Output
const responseStatus = document.getElementById('response-status');
const responseTime = document.getElementById('response-time');
const responseCount = document.getElementById('response-count');
const welcomeMsg = document.getElementById('console-welcome-msg');
const jsonRenderer = document.getElementById('json-renderer');

// Action Buttons
const btnTestConn = document.getElementById('btn-test-connection');
const btnRun = document.getElementById('btn-run');
const btnCopyResult = document.getElementById('btn-copy-result');
const apiStatusIndicator = document.getElementById('api-status-indicator');
const apiStatusText = document.getElementById('api-status-text');

// State Variables
let lastResultData = null;

// --- LocalStorage State Management ---
const STORAGE_KEYS = {
  CONN: 'mongobridge_conn',
  DB: 'mongobridge_db',
  COL: 'mongobridge_col'
};

function loadStoredCredentials() {
  if (localStorage.getItem(STORAGE_KEYS.CONN)) connInput.value = localStorage.getItem(STORAGE_KEYS.CONN);
  if (localStorage.getItem(STORAGE_KEYS.DB)) dbInput.value = localStorage.getItem(STORAGE_KEYS.DB);
  if (localStorage.getItem(STORAGE_KEYS.COL)) colInput.value = localStorage.getItem(STORAGE_KEYS.COL);
}

function saveCredentials() {
  localStorage.setItem(STORAGE_KEYS.CONN, connInput.value.trim());
  localStorage.setItem(STORAGE_KEYS.DB, dbInput.value.trim());
  localStorage.setItem(STORAGE_KEYS.COL, colInput.value.trim());
}

// --- Dynamic Form View Updates ---
function updateFormFieldsVisibility() {
  const action = actionSelect.value;
  
  // Hide all dynamic editors first
  groupQuery.classList.add('hidden');
  groupDocument.classList.add('hidden');
  groupDocuments.classList.add('hidden');
  groupUpdate.classList.add('hidden');
  groupOptions.classList.add('hidden');
  
  switch(action) {
    case 'find':
      groupQuery.classList.remove('hidden');
      groupOptions.classList.remove('hidden');
      break;
    case 'insertOne':
      groupDocument.classList.remove('hidden');
      break;
    case 'insertMany':
      groupDocuments.classList.remove('hidden');
      break;
    case 'updateOne':
    case 'updateMany':
      groupQuery.classList.remove('hidden');
      groupUpdate.classList.remove('hidden');
      groupOptions.classList.remove('hidden');
      break;
    case 'deleteOne':
    case 'deleteMany':
    case 'count':
      groupQuery.classList.remove('hidden');
      break;
  }
}

// --- JSON Syntax Formatting & Highlighting ---
function syntaxHighlight(json) {
  if (typeof json !== 'string') {
    json = JSON.stringify(json, undefined, 2);
  }
  json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g, function (match) {
    let cls = 'json-number';
    if (/^"/.test(match)) {
      if (/:$/.test(match)) {
        cls = 'json-key';
      } else {
        cls = 'json-string';
      }
    } else if (/true|false/.test(match)) {
      cls = 'json-boolean';
    } else if (/null/.test(match)) {
      cls = 'json-null';
    }
    return '<span class="' + cls + '">' + match + '</span>';
  });
}

function formatJsonField(textarea) {
  const rawValue = textarea.value.trim();
  if (!rawValue) {
    textarea.value = '{}';
    return;
  }
  try {
    const parsed = JSON.parse(rawValue);
    textarea.value = JSON.stringify(parsed, null, 2);
    textarea.style.borderColor = '';
  } catch (err) {
    alert(`Invalid JSON in editor: ${err.message}`);
    textarea.style.borderColor = 'var(--error)';
  }
}

// --- UI Interaction Handlers ---
toggleConnBtn.addEventListener('click', () => {
  const isPassword = connInput.type === 'password';
  connInput.type = isPassword ? 'text' : 'password';
  toggleConnBtn.innerHTML = isPassword ? '<i class="fa-regular fa-eye-slash"></i>' : '<i class="fa-regular fa-eye"></i>';
});

actionSelect.addEventListener('change', updateFormFieldsVisibility);

document.querySelectorAll('.btn-format').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const targetId = e.target.getAttribute('data-target');
    const textarea = document.getElementById(targetId);
    formatJsonField(textarea);
  });
});

// --- API Communication Helper ---
async function runQuery(payload) {
  const startTime = performance.now();
  
  responseStatus.textContent = 'PENDING';
  responseStatus.className = 'metric-value badge badge-neutral';
  responseTime.textContent = '-- ms';
  responseCount.textContent = '0';
  
  btnRun.disabled = true;
  btnRun.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Executing...';
  btnTestConn.disabled = true;
  
  try {
    const response = await fetch('/api/mongo', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    const result = await response.json();
    const duration = Math.round(performance.now() - startTime);
    responseTime.textContent = `${duration} ms`;
    
    lastResultData = result;
    
    // UI Display update
    welcomeMsg.classList.add('hidden');
    jsonRenderer.classList.remove('hidden');
    
    if (result.success) {
      responseStatus.textContent = 'SUCCESS';
      responseStatus.className = 'metric-value badge badge-success';
      
      // Calculate display count
      let count = 0;
      if (Array.isArray(result.data)) {
        count = result.data.length;
      } else if (result.data && typeof result.data === 'object') {
        if (result.data.count !== undefined) count = result.data.count;
        else if (result.data.insertedCount !== undefined) count = result.data.insertedCount;
        else if (result.data.modifiedCount !== undefined) count = result.data.modifiedCount;
        else if (result.data.deletedCount !== undefined) count = result.data.deletedCount;
        else count = 1;
      }
      responseCount.textContent = count;
      
      // Render syntax highlighted JSON
      jsonRenderer.innerHTML = syntaxHighlight(result);
    } else {
      responseStatus.textContent = 'ERROR';
      responseStatus.className = 'metric-value badge badge-danger';
      responseCount.textContent = '0';
      jsonRenderer.innerHTML = syntaxHighlight(result);
    }
  } catch (err) {
    const duration = Math.round(performance.now() - startTime);
    responseTime.textContent = `${duration} ms`;
    responseStatus.textContent = 'FAILED';
    responseStatus.className = 'metric-value badge badge-danger';
    
    welcomeMsg.classList.add('hidden');
    jsonRenderer.classList.remove('hidden');
    
    const errObj = { success: false, error: err.message || 'Failed to communicate with Serverless endpoint.' };
    lastResultData = errObj;
    jsonRenderer.innerHTML = syntaxHighlight(errObj);
  } finally {
    btnRun.disabled = false;
    btnRun.innerHTML = '<i class="fa-solid fa-play"></i> Run Operation';
    btnTestConn.disabled = false;
  }
}

// --- Submit form handler ---
mongoForm.addEventListener('submit', (e) => {
  e.preventDefault();
  saveCredentials();
  
  const action = actionSelect.value;
  const payload = {
    connectionString: connInput.value.trim(),
    db: dbInput.value.trim(),
    collection: colInput.value.trim(),
    action: action
  };
  
  // Conditionally parse payload fields
  try {
    if (action === 'find' || action === 'updateOne' || action === 'updateMany' || action === 'deleteOne' || action === 'deleteMany' || action === 'count') {
      const qVal = queryInput.value.trim();
      payload.query = qVal ? JSON.parse(qVal) : {};
    }
    
    if (action === 'insertOne') {
      const docVal = documentInput.value.trim();
      if (!docVal) throw new Error('Document JSON field is required.');
      payload.document = JSON.parse(docVal);
    }
    
    if (action === 'insertMany') {
      const docsVal = documentsInput.value.trim();
      if (!docsVal) throw new Error('Documents JSON Array field is required.');
      const parsed = JSON.parse(docsVal);
      if (!Array.isArray(parsed)) throw new Error('Documents must be a valid JSON array.');
      payload.documents = parsed;
    }
    
    if (action === 'updateOne' || action === 'updateMany') {
      const uVal = updateInput.value.trim();
      if (!uVal) throw new Error('Update Operations JSON field is required.');
      payload.update = JSON.parse(uVal);
    }
    
    if (action === 'find' || action === 'updateOne' || action === 'updateMany') {
      const oVal = optionsInput.value.trim();
      if (oVal) {
        payload.options = JSON.parse(oVal);
      }
    }
  } catch (err) {
    alert(`JSON parsing error: ${err.message}\nMake sure your JSON is valid (use double quotes for keys and values).`);
    return;
  }
  
  runQuery(payload);
});

// --- Test Connection Handler ---
btnTestConn.addEventListener('click', () => {
  const connStr = connInput.value.trim();
  const db = dbInput.value.trim();
  const col = colInput.value.trim();
  
  if (!connStr || !db || !col) {
    alert('Please fill in Connection String, Database, and Collection to test connection.');
    return;
  }
  
  saveCredentials();
  
  // Test connection is simply a lightweight count action with empty query
  const payload = {
    connectionString: connStr,
    db: db,
    collection: col,
    action: 'count',
    query: {}
  };
  
  runQuery(payload);
});

// --- Copy Result to Clipboard ---
btnCopyResult.addEventListener('click', () => {
  if (!lastResultData) return;
  
  const textToCopy = JSON.stringify(lastResultData, null, 2);
  navigator.clipboard.writeText(textToCopy).then(() => {
    const originalIcon = btnCopyResult.innerHTML;
    btnCopyResult.innerHTML = '<i class="fa-solid fa-check" style="color: var(--success)"></i>';
    setTimeout(() => {
      btnCopyResult.innerHTML = originalIcon;
    }, 2000);
  }).catch(err => {
    console.error('Error copying text to clipboard:', err);
  });
});

// --- Ping Server Status on Load ---
async function pingBackendStatus() {
  try {
    // Send a minimal trigger request (missing fields) to see if backend function exists and responds
    const res = await fetch('/api/mongo', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });
    
    // Status 400 is expected because we passed an empty body, but it proves the API endpoint is active!
    if (res.status === 400 || res.status === 200) {
      apiStatusIndicator.className = 'status-indicator online';
      apiStatusText.textContent = 'Server Connected';
    } else {
      apiStatusIndicator.className = 'status-indicator offline';
      apiStatusText.textContent = `Server Offline (HTTP ${res.status})`;
    }
  } catch (err) {
    apiStatusIndicator.className = 'status-indicator offline';
    apiStatusText.textContent = 'Offline (Connection Refused)';
  }
}

// --- Init Application ---
document.addEventListener('DOMContentLoaded', () => {
  loadStoredCredentials();
  updateFormFieldsVisibility();
  pingBackendStatus();
});
