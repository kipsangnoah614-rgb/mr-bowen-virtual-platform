
(() => {
  "use strict";

  const cfg = window.VIRTUAL_PLATFORM_CONFIG || {};
  const apiBase = String(cfg.API_BASE_URL || "").replace(/\/$/, "");

  const $ = (id) => document.getElementById(id);

  async function api(action, fields = {}) {
    const token = sessionStorage.getItem("virtual_platform_token");

    if (!token) {
      throw new Error("Your session has expired. Please sign in again.");
    }

    const response = await fetch(apiBase, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ action, ...fields })
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok || result.error) {
      throw new Error(result.error || "The request could not be completed.");
    }

    return result;
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  function showNotice(message, isError = false) {
    const notice = $("notice");
    if (!notice) return;

    notice.textContent = message;
    notice.hidden = false;
    notice.classList.toggle("error", isError);
    notice.classList.toggle("success", !isError);
  }

  function renderCourses(courses, materials) {
    const panel = document.querySelector("#view-feature .feature-panel");
    if (!panel) return;

    const materialsByCourse = new Map();

    for (const material of materials) {
      const key = String(material.course_id ?? "");
      if (!key) continue;

      if (!materialsByCourse.has(key)) {
        materialsByCourse.set(key, []);
      }

      materialsByCourse.get(key).push(material);
    }

    panel.innerHTML = `
      <div class="feature-symbol">📚</div>
      <h2>My courses</h2>
      <p class="muted">Courses assigned to your enrolled class.</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin:18px 0">
        <button type="button" class="btn btn-primary" id="student-courses-refresh">
          Refresh courses
        </button>
        <button type="button" class="btn btn-light" id="student-courses-back">
          Return to dashboard
        </button>
      </div>
      <div id="student-courses-content">
        ${
          courses.length
            ? courses.map((course) => {
                const courseMaterials =
                  materialsByCourse.get(String(course.id)) || [];

                return `
                  <article class="panel" style="margin:16px 0;text-align:left">
                    <h3>${escapeHtml(course.course_name || course.name || "Course")}</h3>
                    ${
                      course.course_code
                        ? `<p class="muted">Code: ${escapeHtml(course.course_code)}</p>`
                        : ""
                    }
                    ${
                      course.class_name
                        ? `<p class="muted">Class: ${escapeHtml(course.class_name)}</p>`
                        : ""
                    }
                    ${
                      course.description
                        ? `<p>${escapeHtml(course.description)}</p>`
                        : ""
                    }
                    <h4>Learning materials</h4>
                    ${
                      courseMaterials.length
                        ? `<ul>
                            ${courseMaterials.map((material) => `
                              <li style="margin:10px 0">
                                <strong>${escapeHtml(material.title)}</strong>
                                ${
                                  material.description
                                    ? `<p>${escapeHtml(material.description)}</p>`
                                    : ""
                                }
                                <button
                                  type="button"
                                  class="btn btn-light"
                                  data-download-material="${Number(material.id)}"
                                >
                                  Open / Download
                                </button>
                              </li>
                            `).join("")}
                          </ul>`
                        : `<p class="muted">No materials have been added to this course yet.</p>`
                    }
                  </article>
                `;
              }).join("")
            : `<p class="empty">No courses are assigned to your enrolled class yet. Please contact your trainer if you think this is incorrect.</p>`
        }
      </div>
    `;

    $("student-courses-refresh")?.addEventListener("click", loadCourses);
    $("student-courses-back")?.addEventListener("click", () => {
      document.querySelector('[data-view="overview"]')?.click();
    });

    panel.querySelectorAll("[data-download-material]").forEach((button) => {
      button.addEventListener("click", async () => {
        const materialId = Number(button.dataset.downloadMaterial);
        if (!Number.isSafeInteger(materialId) || materialId < 1) return;

        button.disabled = true;
        button.textContent = "Preparing download…";

        try {
          const result = await api("get_material_download", {
            material_id: materialId
          });

          if (!result.download_url) {
            throw new Error("The service did not return a download link.");
          }

          window.open(result.download_url, "_blank", "noopener,noreferrer");
        } catch (error) {
          showNotice(error.message || "Could not open this material.", true);
        } finally {
          button.disabled = false;
          button.textContent = "Open / Download";
        }
      });
    });
  }

  async function loadCourses() {
    const panel = document.querySelector("#view-feature .feature-panel");
    if (!panel) return;

    panel.innerHTML = `
      <div class="feature-symbol">📚</div>
      <h2>My courses</h2>
      <p class="muted">Loading your enrolled class and assigned courses…</p>
    `;

    try {
      const [courseResult, materialResult] = await Promise.all([
        api("list_student_courses"),
        api("list_materials")
      ]);

      renderCourses(
        Array.isArray(courseResult.courses) ? courseResult.courses : [],
        Array.isArray(materialResult.materials) ? materialResult.materials : []
      );
    } catch (error) {
      panel.innerHTML = `
        <div class="feature-symbol">⚠️</div>
        <h2>Unable to load your courses</h2>
        <p class="muted">${escapeHtml(error.message || "Please try again.")}</p>
        <button type="button" class="btn btn-primary" id="student-courses-retry">
          Try again
        </button>
        <button type="button" class="btn btn-light" id="student-courses-back">
          Return to dashboard
        </button>
      `;

      $("student-courses-retry")?.addEventListener("click", loadCourses);
      $("student-courses-back")?.addEventListener("click", () => {
        document.querySelector('[data-view="overview"]')?.click();
      });
    }
  }

  // Intercept only the student's My courses button.
  // Leave all trainer navigation and other student features unchanged.
  document.addEventListener("click", (event) => {
    const button = event.target.closest('[data-feature="courses"]');

    if (!button || document.body.dataset.role !== "student") return;

    event.preventDefault();
    event.stopImmediatePropagation();

    document.querySelectorAll(".view").forEach((view) => {
      view.hidden = true;
    });

    $("view-feature").hidden = false;

    document.querySelectorAll(".nav-item").forEach((item) => {
      item.classList.toggle("active", item === button);
    });

    if ($("page-title")) $("page-title").textContent = "My courses";

    loadCourses();
  }, true);
})();
