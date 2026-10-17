
const form = document.querySelector("#login-form");
const statusBox = document.querySelector("#status");
const submitButton = document.querySelector("#submit-button");

document.querySelector("#year").textContent =
  new Date().getFullYear();

function setStatus(message, success = false) {
  statusBox.textContent = message;
  statusBox.className = success ? "status success" : "status";
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const apiBase = (
    window.VIRTUAL_PLATFORM_CONFIG?.API_BASE_URL || ""
  ).replace(/\/$/, "");

  if (!apiBase) {
    setStatus("The platform backend is not configured.");
    return;
  }

  const username = document.querySelector("#username").value.trim();
  const password = document.querySelector("#password").value;
  const role = document.querySelector("#role").value;

  submitButton.disabled = true;
  setStatus("Verifying your account…");

  try {
    // Clear any previous login session before a new attempt.
    sessionStorage.removeItem("virtualPlatformToken");
    sessionStorage.removeItem("virtualPlatformUser");

    const response = await fetch(apiBase, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ username, password, role })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || data.status !== "authenticated") {
      throw new Error(
        data.error || data.message || "Sign-in failed. Check your details."
      );
    }

    if (!data.token || !data.user) {
      throw new Error("The server returned an incomplete login response.");
    }

    sessionStorage.setItem("virtualPlatformToken", data.token);
    sessionStorage.setItem(
      "virtualPlatformUser",
      JSON.stringify(data.user)
    );

    if (data.user.must_change_password) {
      setStatus(
        "Your account requires a password change before continuing. " +
        "The password-change page still needs to be connected.",
        true
      );
      return;
    }

    setStatus(
      "Credentials verified. Your dashboards and learning features " +
      "are not connected yet, so the platform is not ready for normal use.",
      true
    );
  } catch (error) {
    console.error("Login request failed:", error);
    setStatus(
      error instanceof Error
        ? error.message
        : "Unable to sign in. Please try again."
    );
  } finally {
    submitButton.disabled = false;
  }
});
