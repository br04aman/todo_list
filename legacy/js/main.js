// Elements
const tasksList = document.querySelector("#tasks-list")
const addTaskForm = document.querySelector("form#add-task")
const addTaskInput = document.querySelector("#add-task-input")
const clearAllTasksBtn = document.querySelector("button#clear-all-tasks")
const clearCompletedTasksBtn = document.querySelector("button#clear-completed-tasks")

// Total List Of Tasks
let list = JSON.parse(localStorage.getItem("tasks")) || []

/**
 * Show All Tasks From Local Storage In Page
 */
function showTasksList() {
  tasksList.innerHTML = ""
  list = JSON.parse(localStorage.getItem("tasks")) || []

  if (list.length === 0) {
    clearAllTasksBtn.disabled = true
    clearCompletedTasksBtn.disabled = true

    const element = String.raw`
			<div class="ui icon warning message">
				<i class="inbox icon"></i>
				<div class="content">
					<div class="header">You have no tasks today!</div>
					<div>Enter your tasks today above.</div>
				</div>
			</div>
		`

    tasksList.style.border = "none"
    return tasksList.insertAdjacentHTML("beforeend", element)
  }

  clearAllTasksBtn.disabled = false
  clearCompletedTasksBtn.disabled = !list.some(t => t.completed === true)
  tasksList.style.border = "1px solid rgba(34,36,38,.15)"
  const tasks = [...list].reverse()
  tasks.forEach(task => {
    const createdDate = task.createdAt ? new Date(task.createdAt).toLocaleDateString() : ''
    const createdTime = task.createdAt ? new Date(task.createdAt).toLocaleTimeString() : ''
    const completedDate = task.completedAt ? new Date(task.completedAt).toLocaleDateString() : ''
    const completedTime = task.completedAt ? new Date(task.completedAt).toLocaleTimeString() : ''
    const checkboxId = `task-${task.id}`
    
    const element = String.raw`
				<li class="ui segment grid equal width task-item ${task.completed ? "is-completed" : ""}" data-task-id="${task.id}">
					<div class="ui checkbox column">
						<input id="${checkboxId}" data-task-id="${task.id}" type="checkbox" ${task.completed ? "checked" : ""}>
						<label for="${checkboxId}">${task.text}</label>
						${task.createdAt ? `<div class="task-meta">Created: ${createdDate} at ${createdTime}</div>` : ''}
						${task.completedAt ? `<div class="task-meta is-completed">Completed: ${completedDate} at ${completedTime}</div>` : ''}
					</div>
					<div class="column">
						<i data-id="${task.id}" class="edit outline icon"></i>
						<i data-id="${task.id}" class="trash alternate outline remove icon"></i>
					</div>
				</li>
			`

    tasksList.insertAdjacentHTML("beforeend", element)
  })

  document.querySelectorAll(`li i.edit`).forEach(item => {
    item.addEventListener("click", e => {
      e.stopPropagation()
      showEditModal(+e.target.dataset.id)
    })
  })

  document.querySelectorAll(`li i.trash`).forEach(item => {
    item.addEventListener("click", e => {
      e.stopPropagation()
      showRemoveModal(+e.target.dataset.id)
    })
  })
}

/**
 * Add new task to local storage
 */
function addTask(event) {
  event.preventDefault()

  const taskText = addTaskInput.value
  if (taskText.trim().length === 0) {
    return (addTaskInput.value = "")
  }

  // Find the highest existing ID and add 1
  const maxId = list.length > 0 ? Math.max(...list.map(task => task.id)) : 0
  list.push({
    id: maxId + 1,
    text: taskText,
    completed: false,
    createdAt: new Date().toISOString(),
    completedAt: null
  })
  localStorage.setItem("tasks", JSON.stringify(list))
  addTaskInput.value = ""

  showNotification("success", "Task was successfully added")
  showTasksList()
}

// Change Complete State
function completeTask(id) {
  const taskIndex = list.findIndex(t => t.id === id)
  if (taskIndex === -1) return
  const task = list[taskIndex]

  task.completed = !task.completed
  
  if (task.completed) {
    task.completedAt = new Date().toISOString()
  } else {
    task.completedAt = null
  }
  
  list[taskIndex] = task

  localStorage.setItem("tasks", JSON.stringify(list))
  
  showNotification("success", task.completed ? "Task completed!" : "Task unmarked!")
  showTasksList()
}

/**
 * Remove task
 */
function removeTask(id) {
  list = list.filter(t => t.id !== id)
  localStorage.setItem("tasks", JSON.stringify(list))

  showNotification("error", "Task was successfully deleted")
  showTasksList()
}

/**
 * Edit task
 */
function editTask(id) {
  const taskText = document.querySelector("#task-text").value

  if (taskText.trim().length === 0) return
  const taskIndex = list.findIndex(t => t.id === id)

  list[taskIndex].text = taskText
  localStorage.setItem("tasks", JSON.stringify(list))

  showNotification("success", "Task was successfully updated")
  showTasksList()
}

// Clear All Tasks
function clearAllTasks() {
  if (list.length > 0) {
    list = []
    localStorage.setItem("tasks", JSON.stringify(list))
    return showTasksList()
  }

  new Noty({
    type: "error",
    text: '<i class="close icon"></i> There is no task to remove.',
    layout: "bottomRight",
    timeout: 2000,
    progressBar: true,
    closeWith: ["click"],
    theme: "metroui",
  }).show()
}

// Clear Complete Tasks
function clearCompleteTasks() {
  if (list.length > 0) {
    const filteredTasks = list.filter(t => t.completed !== true)
    if (filteredTasks.length !== list.length) {
      list = filteredTasks
      localStorage.setItem("tasks", JSON.stringify(list))
      return showTasksList()
    }
  }

  Toastify({
    text: "There is no task to remove",
    duration: 3000,
    close: true,
    gravity: "bottom",
    position: "left",
    backgroundColor: "linear-gradient(to right, #e45757, #d44747)",
    stopOnFocus: true,
  }).showToast()
}

// Show Edit Modal And Pass Data
function showEditModal(id) {
  const taskIndex = list.findIndex(t => t.id === id)
  const { text } = list[taskIndex]

  document.querySelector("#edit-modal .content #task-id").value = id
  document.querySelector("#edit-modal .content #task-text").value = text.trim()
  document.querySelector("#update-button").onclick = () => {
    editTask(+id)
    $("#edit-modal.modal").modal("hide")
  }

  $("#edit-modal.modal").modal("show")
}

// Show Remove Modal
function showRemoveModal(id) {
  document.querySelector("#remove-task-button").onclick = () => {
    removeTask(+id)
    $("#remove-modal.modal").modal("hide")
  }

  $("#remove-modal.modal").modal("show")
}

// Show Clear All Tasks Modal
function showClearAllTasksModal() {
  if (list.length > 0) {
    return $("#clear-all-tasks-modal.modal").modal("show")
  }

  new Noty({
    type: "error",
    text: '<i class="close icon"></i> There is no task to remove.',
    layout: "bottomRight",
    timeout: 2000,
    progressBar: true,
    closeWith: ["click"],
    theme: "metroui",
  }).show()
}

function showClearCompletedTasksModal() {
  const hasCompletedTasks = list.some(t => t.completed === true)
  if (hasCompletedTasks) {
    return $("#clear-completed-tasks-modal.modal").modal("show")
  }

  Toastify({
    text: "There is no completed task to remove",
    duration: 3000,
    close: true,
    gravity: "bottom",
    position: "left",
    backgroundColor: "linear-gradient(to right, #e45757, #d44747)",
    stopOnFocus: true,
  }).showToast()
}

function showNotification(type, text) {
  new Noty({
    type,
    text: `<i class="check icon"></i> ${text}`,
    layout: "bottomRight",
    timeout: 2000,
    progressBar: true,
    closeWith: ["click"],
    theme: "metroui",
  }).show()
}

// Event Listeners
addTaskForm.addEventListener("submit", addTask)
tasksList.addEventListener("change", e => {
  const target = e.target
  if (!(target instanceof HTMLInputElement)) return
  if (target.type !== "checkbox") return
  const taskId = Number(target.dataset.taskId)
  if (Number.isNaN(taskId)) return
  completeTask(taskId)
})
document.querySelector("#clear-all-confirm-button").addEventListener("click", () => {
  clearAllTasks()
  $("#clear-all-tasks-modal.modal").modal("hide")
})
document.querySelector("#clear-completed-confirm-button").addEventListener("click", () => {
  clearCompleteTasks()
  $("#clear-completed-tasks-modal.modal").modal("hide")
})
window.addEventListener("load", () => addTaskInput.focus())

showTasksList()
