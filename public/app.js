const operations = {
  list: {
    title: 'Listar todas las notas',
    description: 'Consulta el estado actual del almacenamiento en memoria.',
    method: 'GET',
    path: '/api/notas',
    body: null,
    needsId: false,
    learning: 'Express recibe la petición y el servicio devuelve el arreglo guardado en memoria.',
    tip: 'Un estado 200 indica que la consulta se completó correctamente.',
    flow: 4,
  },
  get: {
    title: 'Buscar una nota por ID',
    description: 'Recupera una sola nota o explica claramente por qué no existe.',
    method: 'GET',
    path: '/api/notas/:id',
    body: null,
    needsId: true,
    learning: 'El ID viaja en la URL. El servicio busca la nota y produce 404 si no la encuentra.',
    tip: 'Probá un ID inexistente para observar el error 404 controlado.',
    flow: 4,
  },
  create: {
    title: 'Crear una nota',
    description: 'Envía título y contenido, pasa por Zod y guarda la nota en memoria.',
    method: 'POST',
    path: '/api/notas',
    body: {
      titulo: 'Repaso del laboratorio',
      contenido: 'Express organiza las rutas de la API. Zod valida las solicitudes. DeepSeek genera respuestas desde el backend.',
    },
    needsId: false,
    learning: 'Zod verifica tipos y longitudes antes de que el servicio cree una nota con ID incremental.',
    tip: 'El estado 201 significa “recurso creado”. Revisá también el header Location en Swagger.',
    flow: 4,
  },
  delete: {
    title: 'Eliminar una nota',
    description: 'Borra una nota existente usando su identificador.',
    method: 'DELETE',
    path: '/api/notas/:id',
    body: null,
    needsId: true,
    learning: 'El servicio confirma que la nota existe, la elimina y devuelve 204 sin body.',
    tip: '204 es una respuesta exitosa sin contenido. La consola lo representa como “Sin contenido”.',
    flow: 4,
  },
  ask: {
    title: 'Preguntar a DeepSeek',
    description: 'Valida una pregunta libre y llama al proveedor desde el backend.',
    method: 'POST',
    path: '/api/ia/preguntar',
    body: { pregunta: '¿Qué función cumple un middleware en Express?' },
    needsId: false,
    learning: 'El navegador habla con Express; solo el servicio del backend conoce la clave y llama a DeepSeek.',
    tip: 'La respuesta incluye tokens reales. Una pregunta inválida se rechaza antes de consumir créditos.',
    flow: 5,
  },
  summary: {
    title: 'Resumir una nota con IA',
    description: 'Busca la nota y solicita exactamente tres viñetas breves en español.',
    method: 'POST',
    path: '/api/notas/:id/resumen',
    body: null,
    needsId: true,
    learning: 'La nota se busca primero. Solo si existe, el backend arma los mensajes y llama a DeepSeek.',
    tip: 'Un ID inexistente produce 404 sin hacer una llamada al proveedor ni consumir tokens.',
    flow: 5,
  },
};

const state = {
  selected: 'list',
  history: [],
  latestNoteId: 1,
  evidence: new Set(),
  lastResponse: '',
};

const elements = {
  operationList: document.querySelector('#operationList'),
  title: document.querySelector('#operationTitle'),
  description: document.querySelector('#operationDescription'),
  method: document.querySelector('#requestMethod'),
  path: document.querySelector('#requestPath'),
  idField: document.querySelector('#idField'),
  noteId: document.querySelector('#noteId'),
  bodyField: document.querySelector('#bodyField'),
  requestBody: document.querySelector('#requestBody'),
  emptyBody: document.querySelector('#emptyBody'),
  learning: document.querySelector('#learningText'),
  tip: document.querySelector('#operationTip p'),
  send: document.querySelector('#sendRequest'),
  responseStatus: document.querySelector('#responseStatus'),
  responseTime: document.querySelector('#responseTime'),
  responseSize: document.querySelector('#responseSize'),
  responseOutput: document.querySelector('#responseOutput'),
  copy: document.querySelector('#copyResponse'),
  tokenRow: document.querySelector('#tokenRow'),
  inputTokens: document.querySelector('#inputTokens'),
  outputTokens: document.querySelector('#outputTokens'),
  totalTokens: document.querySelector('#totalTokens'),
  noteCount: document.querySelector('#noteCount'),
  connection: document.querySelector('#connectionStatus'),
  flow: document.querySelector('#requestFlow'),
  history: document.querySelector('#historyList'),
  clearHistory: document.querySelector('#clearHistory'),
  evidenceCount: document.querySelector('#evidenceCount'),
  toast: document.querySelector('#toast'),
};

function methodClass(method, key) {
  if (key === 'ask' || key === 'summary') return 'ai';
  if (method === 'DELETE') return 'delete';
  return method.toLowerCase();
}

function selectOperation(key) {
  const operation = operations[key];
  if (!operation) return;
  state.selected = key;

  document.querySelectorAll('.operation').forEach((button) => {
    button.classList.toggle('active', button.dataset.operation === key);
  });

  elements.title.textContent = operation.title;
  elements.description.textContent = operation.description;
  elements.method.textContent = operation.method === 'DELETE' ? 'DEL' : operation.method;
  elements.method.className = `method ${methodClass(operation.method, key)}`;
  elements.path.textContent = operation.path.replace(':id', elements.noteId.value || state.latestNoteId);
  elements.idField.classList.toggle('hidden', !operation.needsId);
  elements.bodyField.classList.toggle('hidden', !operation.body);
  elements.emptyBody.classList.toggle('hidden', Boolean(operation.body));
  elements.requestBody.value = operation.body ? JSON.stringify(operation.body, null, 2) : '';
  elements.learning.textContent = operation.learning;
  elements.tip.textContent = operation.tip;

  Array.from(elements.flow.children).forEach((item, index) => {
    item.classList.toggle('active', index < operation.flow);
  });
}

function getRequest() {
  const operation = operations[state.selected];
  const id = Number(elements.noteId.value);
  if (operation.needsId && (!Number.isInteger(id) || id < 1)) {
    throw new Error('Ingresá un ID entero mayor que cero.');
  }

  const path = operation.path.replace(':id', id);
  const options = { method: operation.method, headers: {} };
  if (operation.body) {
    let body;
    try {
      body = JSON.parse(elements.requestBody.value);
    } catch {
      throw new Error('El body no contiene JSON válido. Revisá comillas y comas.');
    }
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }
  return { operation, path, options };
}

function statusClass(status) {
  if (status >= 200 && status < 300) return 'success';
  if (status >= 400 && status < 500) return 'client-error';
  return 'server-error';
}

function renderTokens(data) {
  const usage = data?.uso;
  const visible = Number.isInteger(usage?.input_tokens) && Number.isInteger(usage?.output_tokens);
  elements.tokenRow.classList.toggle('hidden', !visible);
  if (!visible) return;
  elements.inputTokens.textContent = usage.input_tokens;
  elements.outputTokens.textContent = usage.output_tokens;
  elements.totalTokens.textContent = usage.input_tokens + usage.output_tokens;
}

function addHistory({ method, path, status, elapsed }) {
  state.history.unshift({ method, path, status, elapsed, at: new Date() });
  state.history = state.history.slice(0, 8);
  renderHistory();
}

function renderHistory() {
  if (!state.history.length) {
    elements.history.innerHTML = '<div class="history-empty">Las solicitudes ejecutadas aparecerán aquí.</div>';
    return;
  }
  elements.history.innerHTML = state.history.map((item) => `
    <div class="history-item">
      <span class="method ${methodClass(item.method, '')}">${item.method === 'DELETE' ? 'DEL' : item.method}</span>
      <code>${escapeHtml(item.path)}</code>
      <span class="history-status ${item.status < 400 ? 'ok' : 'bad'}">${item.status}</span>
      <span class="history-time">${item.elapsed} ms · ${item.at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
    </div>`).join('');
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[char]);
}

function markEvidence(key, status) {
  if (key === 'ask' && status >= 200 && status < 300) state.evidence.add('ask');
  if (key === 'summary' && status >= 200 && status < 300) state.evidence.add('summary');
  if (key === 'ask' && status === 502) state.evidence.add('error');
  document.querySelectorAll('[data-evidence]').forEach((item) => {
    const done = state.evidence.has(item.dataset.evidence);
    item.classList.toggle('done', done);
    item.textContent = done ? '✓' : ({ ask: '1', summary: '2', error: '3' })[item.dataset.evidence];
  });
  elements.evidenceCount.textContent = state.evidence.size;
}

async function executeRequest() {
  let request;
  try {
    request = getRequest();
  } catch (error) {
    showToast(error.message);
    return;
  }

  elements.send.disabled = true;
  elements.send.querySelector('span:first-child').textContent = 'Enviando…';
  elements.responseOutput.classList.add('loading');
  elements.responseOutput.textContent = 'Esperando respuesta del servidor…';
  elements.responseStatus.className = 'status-pill idle';
  elements.responseStatus.textContent = 'En curso';
  elements.tokenRow.classList.add('hidden');

  const started = performance.now();
  try {
    const response = await fetch(request.path, request.options);
    const elapsed = Math.round(performance.now() - started);
    const raw = await response.text();
    let data = null;
    if (raw) {
      try { data = JSON.parse(raw); } catch { data = raw; }
    }
    const formatted = data === null ? 'Sin contenido' : JSON.stringify(data, null, 2);

    state.lastResponse = formatted;
    elements.responseOutput.textContent = formatted;
    elements.responseOutput.classList.remove('loading');
    elements.responseStatus.className = `status-pill ${statusClass(response.status)}`;
    elements.responseStatus.textContent = `${response.status} ${response.statusText || ''}`.trim();
    elements.responseTime.textContent = `${elapsed} ms`;
    elements.responseSize.textContent = `${new TextEncoder().encode(raw).length} bytes`;
    elements.copy.disabled = false;
    renderTokens(data);
    addHistory({ method: request.operation.method, path: request.path, status: response.status, elapsed });
    markEvidence(state.selected, response.status);

    if (response.ok && state.selected === 'create' && Number.isInteger(data?.id)) {
      state.latestNoteId = data.id;
      elements.noteId.value = data.id;
      showToast(`Nota ${data.id} creada. Ya podés resumirla.`);
    }
    if (response.ok && ['list', 'create', 'delete'].includes(state.selected)) refreshHealth();
  } catch {
    const elapsed = Math.round(performance.now() - started);
    const message = 'No se pudo conectar con el backend. Confirmá que npm run dev esté activo.';
    state.lastResponse = message;
    elements.responseOutput.textContent = message;
    elements.responseOutput.classList.remove('loading');
    elements.responseStatus.className = 'status-pill server-error';
    elements.responseStatus.textContent = 'Sin conexión';
    elements.responseTime.textContent = `${elapsed} ms`;
    elements.responseSize.textContent = '— bytes';
    addHistory({ method: request.operation.method, path: request.path, status: 'ERR', elapsed });
  } finally {
    elements.send.disabled = false;
    elements.send.querySelector('span:first-child').textContent = 'Ejecutar';
  }
}

async function refreshHealth() {
  try {
    const response = await fetch('/api/notas');
    if (!response.ok) throw new Error();
    const notes = await response.json();
    elements.noteCount.textContent = notes.length;
    if (notes.length) {
      state.latestNoteId = notes.at(-1).id;
      elements.noteId.value = state.latestNoteId;
    }
    elements.connection.className = 'connection online';
    elements.connection.lastChild.textContent = ' API conectada';
  } catch {
    elements.noteCount.textContent = '—';
    elements.connection.className = 'connection offline';
    elements.connection.lastChild.textContent = ' API desconectada';
  }
}

let toastTimer;
function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => elements.toast.classList.remove('show'), 3200);
}

elements.operationList.addEventListener('click', (event) => {
  const button = event.target.closest('[data-operation]');
  if (button) selectOperation(button.dataset.operation);
});
elements.noteId.addEventListener('input', () => {
  const operation = operations[state.selected];
  elements.path.textContent = operation.path.replace(':id', elements.noteId.value || ':id');
});
elements.send.addEventListener('click', executeRequest);
elements.copy.addEventListener('click', async () => {
  await navigator.clipboard.writeText(state.lastResponse);
  showToast('Respuesta copiada al portapapeles.');
});
elements.clearHistory.addEventListener('click', () => {
  state.history = [];
  renderHistory();
});
document.querySelectorAll('.evidence-item').forEach((item) => {
  item.addEventListener('click', () => {
    selectOperation(item.dataset.operation);
    document.querySelector('.request-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (item.dataset.errorGuide) {
      showToast('Para obtener 502, iniciá el backend con una clave deliberadamente falsa.');
    }
  });
});

selectOperation('list');
refreshHealth();
