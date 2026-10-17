
const CONFIG = window.VIRTUAL_PLATFORM_CONFIG || {};
const API_BASE_URL = CONFIG.API_BASE_URL;

const LOGIN_PAGE = "index.html";
const TRAINER_DASHBOARD = "trainer-dashboard.html";
const STUDENT_DASHBOARD = "student-dashboard.html";
const CHANGE_PASSWORD_PAGE = "change-password.html";

const TOKEN_KEY = "virtual_platform_token";
const USER_KEY = "virtual_platform_user";

document.addEventListener("DOMContentLoaded", () => {
  const loginForm =
    document.querySelector("#login-form") ||
    document.querySelector("#loginForm") ||
    document.querySelector("form");

  const statusElement =
    document.querySelector("#status") ||
    document.querySelector("#login-status") ||
    document.querySelector("#message");

  if (!API_BASE_URL) {
    setStatus("Configuration error: API URL is missing.", false);
    return;
  }

  function setStatus(message, success = false) {
    if (statusElement) {
      statusElement.textContent = message;
      statusElement.style.color = success ? "green" : "red";
      statusElement.setAttribute("role", "status");
    } else {
      alert(message);
    }
  }

  function getInputValue(selectors) {
    for (const selector of selectors) {
      const input = document.querySelector(selector);
      if (input) return input.value.trim();
    }
    return "";
  }

  async function callAPI(action, payload) {
    const response = await fetch(API_BASE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        action,
        ...payload
      })
    });

    let data;

    try {
      data = await response.json();
    } catch {
      throw new Error("The server returned an invalid response.");
    }

    if (!response.ok || data.error || data.success === false) {
      throw new Error(
        data.message ||
        data.error ||
        `Request failed (${response.status}).`
      );
    }

    return data;
  }

  function saveSession(data) {
    if (!data.token || !data.user) {
      throw new Error("The server did not return a valid login session.");
    }

    sessionStorage.setItem(TOKEN_KEY, data.token);
    sessionStorage.setItem(USER_KEY, JSON.stringify(data.user));
  }

  function redirectAfterLogin(user) {
    if (user.must_change_password) {
      window.location.href = CHANGE_PASSWORD_PAGE;
      return;
    }

    const role = String(user.role || "").toLowerCase();

    if (role === "trainer") {
      window.location.href = TRAINER_DASHBOARD;
    } else if (role === "student") {
      window.location.href = STUDENT_DASHBOARD;
    } else {
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(USER_KEY);
      setStatus(
        "Your account role is not recognized. Please contact the administrator.",
        false
      );
    }
  }

  if (!loginForm) {
    console.warn(
      "Login form not found. Check the form ID in index.html."
    );
    return;
  }

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const username = getInputValue([
      "#username",
      "#login-username",
      'input[name="username"]',
      'input[name="email"]'
    ]);

    const password = getInputValue([
      "#password",
      "#login-password",
      'input[name="password"]'
    ]);

    if (!username || !password) {
      setStatus("Enter your username and password.", false);
      return;
    }

    const submitButton = loginForm.querySelector(
      'button[type="submit"], input[type="submit"]'
    );

    if (submitButton) submitButton.disabled = true;

    setStatus("Signing in...", true);

    try {
      const data = await callAPI("login", {
        username,
        password
      });

      if (data.status && data.status !== "authenticated") {
        throw new Error(data.message || "Login was not successful.");
      }

      saveSession(data);
      redirectAfterLogin(data.user);
    } catch (error) {
      setStatus(error.message || "Unable to sign in.", false);
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });

  // Existing authenticated users can continue to their appropriate page.
  const currentToken = sessionStorage.getItem(TOKEN_KEY);
  const currentUserText = sessionStorage.getItem(USER_KEY);

  if (currentToken && currentUserText) {
    try {
      const currentUser = JSON.parse(currentUserText);

      if (currentUser.must_change_password) {
        window.location.href = CHANGE_PASSWORD_PAGE;
      } else if (currentUser.role === "trainer") {
        window.location.href = TRAINER_DASHBOARD;
      } else if (currentUser.role === "student") {
        window.location.href = STUDENT_DASHBOARD;
      }
    } catch {
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(USER_KEY);
    }
  }
});
