import { makeNonStreamingRequest } from './api.js';

export function initTodo() {
  const todoInput = document.getElementById('todoInput');
  const todoSpiciness = document.getElementById('todoSpiciness');
  const spicinessVal = document.getElementById('spicinessVal');
  const todoSubmitBtn = document.getElementById('todoSubmitBtn');
  const todoCopyBtn = document.getElementById('todoCopyBtn');
  const todoClearBtn = document.getElementById('todoClearBtn');
  const todoPlaceholder = document.getElementById('todoPlaceholder');
  const todoSkeleton = document.getElementById('todoSkeleton');
  const todoListContainer = document.getElementById('todoListContainer');

  if (!todoInput || !todoSubmitBtn || !todoListContainer) {
    console.warn("Magic ToDo DOM elements not found, skipping.");
    return;
  }

  todoSpiciness.addEventListener('input', (e) => { spicinessVal.textContent = `${e.target.value}🌶️`; });

  function parseTasks(text) {
    const startIdx = text.indexOf('['); const endIdx = text.lastIndexOf(']');
    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      try {
        const parsed = JSON.parse(text.substring(startIdx, endIdx + 1));
        if (Array.isArray(parsed)) return parsed.map(item => item.toString().trim());
      } catch (e) { console.warn("JSON parsing failed", e); }
    }
    return text.split('\n').map(l => l.trim()).filter(l => l.startsWith('-') || l.startsWith('*') || /^\d+\./.test(l))
      .map(l => l.replace(/^[-*\s]+/, '').replace(/^\d+\.\s*/, '').trim()).filter(i => i.length > 0);
  }

  function createTodoItemElement(taskText) {
    const item = document.createElement('div');
    item.className = 'todo-item-wrapper';
    item.innerHTML = `
      <div class="todo-item">
        <input type="checkbox" class="todo-checkbox">
        <label class="todo-label" contenteditable="true">${taskText}</label>
        <div class="todo-item-actions">
          <button class="subdivide-btn" title="Sous-diviser">🌶️ Découper plus</button>
          <button class="btn btn-icon btn-sm delete-btn" title="Supprimer">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path></svg>
          </button>
        </div>
      </div>
      <div class="sub-tasks-list" style="display: none;"></div>
    `;
    const checkbox = item.querySelector('.todo-checkbox'); const todoItem = item.querySelector('.todo-item');
    checkbox.addEventListener('change', () => { checkbox.checked ? todoItem.classList.add('checked') : todoItem.classList.remove('checked'); });
    item.querySelector('.delete-btn').addEventListener('click', () => { item.remove(); checkTodoListEmpty(); });
    const subdivideBtn = item.querySelector('.subdivide-btn'); const subTasksList = item.querySelector('.sub-tasks-list');
    
    subdivideBtn.addEventListener('click', () => {
      const label = item.querySelector('.todo-label').textContent.trim();
      const mainTask = todoInput.value.trim() || "Tâche";
      subdivideBtn.disabled = true; subdivideBtn.innerHTML = `⏳ Découpage...`;
      
      makeNonStreamingRequest(`Découpe cette sous-étape en 3 à 5 micro-étapes simples.\nTâche principale: "${mainTask}"\nSous-étape: "${label}"\nRends ta réponse en tableau JSON ex: ["a", "b"].`, { tool: 'todo' })
      .then(responseText => {
        const subTasks = parseTasks(responseText);
        if (subTasks.length === 0) { alert("Impossible de découper l'étape."); return; }
        subTasksList.innerHTML = ''; subTasksList.style.display = 'flex';
        subTasks.forEach(subText => {
          const subItem = createTodoItemElement(subText);
          subItem.querySelector('.subdivide-btn').remove();
          subTasksList.appendChild(subItem);
        });
      }).catch(err => { alert("Erreur lors du découpage."); }).finally(() => { subdivideBtn.disabled = false; subdivideBtn.innerHTML = `🌶️ Découper plus`; });
    });
    return item;
  }

  function checkTodoListEmpty() {
    if (todoListContainer.children.length === 0) {
      todoListContainer.style.display = 'none'; todoPlaceholder.style.display = 'flex';
      todoCopyBtn.disabled = true; todoClearBtn.disabled = true;
    }
  }

  todoSubmitBtn.addEventListener('click', () => {
    const task = todoInput.value.trim();
    if (!task) { alert("Saisissez une tâche."); return; }
    todoSubmitBtn.disabled = true; todoSubmitBtn.querySelector('.btn-text').textContent = 'Découpage...';
    todoSubmitBtn.querySelector('.btn-loader').style.display = 'block';
    todoPlaceholder.style.display = 'none'; todoSkeleton.style.display = 'flex';
    todoListContainer.style.display = 'none'; todoListContainer.innerHTML = '';
    todoCopyBtn.disabled = true; todoClearBtn.disabled = true;

    makeNonStreamingRequest(`Découpe la tâche suivante en étapes simples. Niveau de détail : ${todoSpiciness.value}/5.\nTâche : "${task}"\nRends uniquement un tableau JSON de chaînes de caractères. Exemple: ["étape 1", "étape 2"].`, { tool: 'todo' })
    .then(responseText => {
      todoSkeleton.style.display = 'none';
      const tasks = parseTasks(responseText);
      if (tasks.length === 0) {
        todoPlaceholder.style.display = 'flex'; todoPlaceholder.querySelector('p').textContent = "Erreur de format du modèle."; return;
      }
      todoListContainer.style.display = 'flex';
      tasks.forEach(t => todoListContainer.appendChild(createTodoItemElement(t)));
      todoCopyBtn.disabled = false; todoClearBtn.disabled = false;
    }).catch(err => {
      todoSkeleton.style.display = 'none'; todoPlaceholder.style.display = 'flex';
      todoPlaceholder.querySelector('p').innerHTML = `<span style="color:red">Erreur :</span> ${err.message}`;
    }).finally(() => {
      todoSubmitBtn.disabled = false; todoSubmitBtn.querySelector('.btn-text').textContent = 'Découper la tâche';
      todoSubmitBtn.querySelector('.btn-loader').style.display = 'none';
    });
  });

  todoClearBtn.addEventListener('click', () => { todoListContainer.innerHTML = ''; checkTodoListEmpty(); });
  todoCopyBtn.addEventListener('click', () => {
    const items = Array.from(todoListContainer.querySelectorAll('.todo-label')).map(label => `- [ ] ${label.textContent.trim()}`).join('\n');
    navigator.clipboard.writeText(items).then(() => {
      const original = todoCopyBtn.innerHTML;
      todoCopyBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="var(--success-color)" stroke-width="2.5" width="18" height="18"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
      setTimeout(() => todoCopyBtn.innerHTML = original, 1500);
    });
  });
}
