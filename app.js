const CONFIG = window.VIRTUAL_PLATFORM_CONFIG || {};
const API_BASE_URL = CONFIG.API_BASE_URL;

const TOKEN_KEY = "virtual_platform_token";
const USER_KEY = "virtual_platform_user";

document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector("#login-form");
  const status = document.querySelector("#status");

  function showStatus(message, success = false) {
    if (!status) return;
    status.textContent = message;
    status.style.color = success ? "green" : "red";
  }

  if (!API_BASE_URL) {
    showStatus("Configuration error: backend URL is missing.");
    return;
  }

  if (!form) {
    showStatus("Login form could not be found.");
    return;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const role = document.querySelector("#role")?.value;
    const username = document.querySelector("#username")?.value.trim();
    const password = document.querySelector("#password")?.value;

    if (!role || !["student", "trainer"].includes(role)) {
      showStatus("Please select a valid account type.");
      return;
    }

    if (!username || !password) {
      showStatus("Enter your username and password.");
      return;
    }

    const button = form.querySelector('button[type="submit"]');
    if (button) button.disabled = true;

    showStatus("Signing in...", true);

    try {
      const response = await fetch(API_BASE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          action: "login",
          username,
          password,
          role
        })
      });

      const data = await response.json();

      if (!response.ok || data.error || data.success === false) {
        throw new Error(
          data.message || data.error ||
          "Login failed. Check your account details."
        );
      }

      if (
        data.status !== "authenticated" ||
        !data.token ||
        !data.user
      ) {
        throw new Error(
          data.message || "The server did not return a valid login session."
        );
      }

      const actualRole = String(data.user.role || "").toLowerCase();

      if (actualRole !== role) {
        throw new Error(
          "The selected account type does not match your account."
        );
      }

      sessionStorage.setItem(TOKEN_KEY, data.token);
      sessionStorage.setItem(USER_KEY, JSON.stringify(data.user));

      if (data.user.must_change_password) {
        window.location.href = "change-password.html";
      } else if (actualRole === "trainer") {
        window.location.href = "trainer-dashboard.html";
      } else {
        window.location.href = "student-dashboard.html";
      }
    } catch (error) {
      showStatus(error.message || "Unable to sign in.");
    } finally {
      if (button) button.disabled = false;
    }
  });
});
