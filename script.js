const API = "http://localhost:3333";

const $ = (s) => document.querySelector(s);

const habitsList = $("#habits");

let selectedHabitId = null;
let editingHabitId = null;

const theme =
  localStorage.getItem("theme") ||
  (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");

document.body.classList.toggle("dark", theme === "dark");

updateThemeIcon();

function updateThemeIcon() {
  $("#theme-btn").innerHTML = document.body.classList.contains("dark")
    ? `<i class="ph ph-sun"></i>`
    : `<i class="ph ph-moon-stars"></i>`;
}

const toast = (text, ok = true) =>
  Toastify({
    text: `
      <div style="display:flex;align-items:center;gap:10px;">
        <i class="ph ${
          ok ? "ph-check-circle" : "ph-warning-circle"
        }" style="font-size:18px;"></i>
        <span>${text}</span>
      </div>
    `,
    escapeMarkup: false,
    duration: 2500,
    gravity: "top",
    position: "right",
    style: {
      borderRadius: "16px",
      padding: "14px 18px",
      background: ok
        ? document.body.classList.contains("dark")
          ? "#14532d"
          : "#dcfce7"
        : document.body.classList.contains("dark")
          ? "#7f1d1d"
          : "#fee2e2",
      color: ok
        ? document.body.classList.contains("dark")
          ? "#dcfce7"
          : "#166534"
        : document.body.classList.contains("dark")
          ? "#fee2e2"
          : "#991b1b",
    },
  }).showToast();

const req = async (url, options, success) => {
  try {
    const res = await fetch(`${API}${url}`, options);

    if (!res.ok) throw new Error();

    if (success) toast(success);

    return res.headers.get("content-type")?.includes("application/json")
      ? res.json()
      : res;
  } catch {
    toast("Algo deu errado", false);
  }
};

const values = (id) =>
  $(id)
    .value.split(",")
    .map((v) => v.trim())
    .filter(Boolean);

function toggleTheme() {
  document.body.classList.toggle("dark");

  localStorage.setItem(
    "theme",
    document.body.classList.contains("dark") ? "dark" : "light",
  );

  updateThemeIcon();
}

function openCreateModal() {
  editingHabitId = null;

  $("#modal-title").textContent = "Novo hábito";

  ["#name", "#description", "#tags"].forEach((id) => ($(id).value = ""));

  $("#frequency").value = "daily";

  $("#habit-modal").classList.add("open");
}

function closeModal() {
  $("#habit-modal").classList.remove("open");
}

async function submitHabit() {
  const payload = {
    name: $("#name").value,
    description: $("#description").value,
    frequency: $("#frequency").value,
    tags: values("#tags"),
  };

  if (editingHabitId) {
    await req(
      `/habits/${editingHabitId}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
      "Hábito atualizado",
    );
  } else {
    await req(
      "/habits",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
      "Hábito criado",
    );
  }

  closeModal();
  loadHabits();
}

async function loadHabits() {
  const params = new URLSearchParams();

  if ($("#search").value) {
    params.set("search", $("#search").value);
  }

  values("#tags-filter").forEach((tag) => params.append("tags", tag));

  const data = await req(`/habits?${params}`, {}, null);

  if (!data) return;

  habitsList.innerHTML = "";

  const habits = Array.isArray(data) ? data : data.habits || [];

  for (const habit of habits) {
    renderHabit(habit, habitsList);
  }
}

async function renderHabit(habit, container) {
  const metrics = await req(`/habits/${habit.id}/metrics`, {}, null);

  if (!metrics) return;

  const today = new Date().toISOString().split("T")[0];

  const isDone = metrics.logs.find((l) => l.date === today)?.completed;

  const li = document.createElement("li");

  li.className = `habit ${isDone ? "done" : "not-done"}`;

  li.innerHTML = `
    <div class="habit-header">
      <div>
        <div class="habit-title">
          <strong>${habit.name}</strong>
        </div>

        <div class="habit-frequency">
          ${habit.frequency === "daily" ? "Diário" : "Semanal"}
        </div>
      </div>
    </div>

    <p>
      ${habit.description || "Sem descrição"}
    </p>

    <div class="tag-list">
      ${habit.tags
        .map((tag) => `<span class="tag">#${tag.name}</span>`)
        .join("")}
    </div>

    <div class="status ${isDone ? "done" : "pending"}">
      <i class="ph ${isDone ? "ph-check-circle" : "ph-clock"}"></i>

      ${isDone ? "Concluído hoje" : "Pendente"}
    </div>

    <div class="completion-rate">
      Taxa de conclusão:
      <strong>
        ${(metrics.completionRate * 100).toFixed(0)}%
      </strong>
    </div>

    <div class="actions">
      <button
        class="action-btn action-success"
        onclick="toggleHabit('${habit.id}', ${!isDone})"
      >
        <i class="ph ${isDone ? "ph-x-circle" : "ph-check-circle"}"></i>

        ${isDone ? "Desmarcar" : "Concluir"}
      </button>

      <button
        class="action-btn action-primary"
        onclick="openMetrics('${habit.id}')"
      >
        <i class="ph ph-chart-line"></i>
        Métricas
      </button>

      <button
        class="action-btn action-primary"
        onclick="editHabit('${habit.id}')"
      >
        <i class="ph ph-pencil-simple"></i>
        Editar
      </button>

      <button
        class="action-btn action-danger"
        onclick="deleteHabit('${habit.id}')"
      >
        <i class="ph ph-trash"></i>
        Excluir
      </button>
    </div>
  `;

  container.appendChild(li);
}

async function editHabit(id) {
  const data = await req("/habits", {}, null);

  if (!data) return;

  const habits = Array.isArray(data) ? data : data.habits || [];

  const habit = habits.find((h) => h.id === id);

  editingHabitId = id;

  $("#modal-title").textContent = "Editar hábito";

  $("#name").value = habit.name;
  $("#description").value = habit.description || "";
  $("#tags").value = habit.tags.map((t) => t.name).join(", ");

  $("#frequency").value = habit.frequency;

  $("#habit-modal").classList.add("open");
}

async function deleteHabit(id) {
  await req(
    `/habits/${id}`,
    {
      method: "DELETE",
    },
    "Hábito excluído",
  );

  if (selectedHabitId === id) {
    selectedHabitId = null;

    $("#metrics-wrapper").classList.add("hidden");

    $("#metrics").innerHTML = "";
  }

  loadHabits();
}

async function toggleHabit(id, completed) {
  await req(
    `/habits/${id}/check`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ completed }),
    },
    completed ? "Hábito concluído" : "Hábito desmarcado",
  );

  loadHabits();

  if (selectedHabitId === id) {
    renderMetrics(id);
  }
}

function openMetrics(id) {
  selectedHabitId = id;

  renderMetrics(id);
}

async function renderMetrics(id) {
  const data = await req(`/habits/${id}/metrics`, {}, null);

  if (!data) return;

  $("#metrics-wrapper").classList.remove("hidden");

  $("#metrics").innerHTML = `
    <h3>Métricas do hábito</h3>

    <div class="metric-grid">
      <div class="metric-card">
        <span>Total de dias</span>
        <strong>${data.totalDays}</strong>
      </div>

      <div class="metric-card">
        <span>Dias concluídos</span>
        <strong>${data.completedDays}</strong>
      </div>

      <div class="metric-card">
        <span>Taxa de sucesso</span>
        <strong>
          ${(data.completionRate * 100).toFixed(1)}%
        </strong>
      </div>
    </div>

    <h4>Histórico diário</h4>

    <div class="logs">
      ${data.logs
        .map(
          (log) => `
            <div class="log-item">
              <span>${log.date}</span>

              <strong>
                ${log.completed ? "✅ Concluído" : "❌ Falhou"}
              </strong>
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

async function exportHabits() {
  const res = await fetch(`${API}/habits/export`);

  if (!res.ok) {
    return toast("Erro ao exportar hábitos", false);
  }

  const blob = await res.blob();

  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");

  a.href = url;
  a.download = "habitos-exportados.csv";

  a.click();

  URL.revokeObjectURL(url);

  toast("Exportação concluída");
}

async function importHabits(event) {
  const file = event.target.files[0];

  if (!file) return;

  const text = await file.text();

  const res = await fetch(`${API}/habits/import`, {
    method: "POST",
    headers: {
      "Content-Type": "text/csv",
    },
    body: text,
  });

  if (!res.ok) {
    return toast("Erro ao importar hábitos", false);
  }

  const data = await res.json();

  toast(`${data.imported} hábitos importados`);

  event.target.value = "";

  loadHabits();
}

function downloadExampleCsv() {
  const csv = Papa.unparse([
    {
      name: "Beber água",
      description: "Beber 2L por dia",
      frequency: "daily",
      targetPerPeriod: 2,
      tags: "saude,agua",
    },
  ]);

  const blob = new Blob([csv], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");

  a.href = url;
  a.download = "habitos-exemplo.csv";

  a.click();

  URL.revokeObjectURL(url);
}

loadHabits();
