// Reset Password Page Logic
let email = '';
let otpVerified = false;
let resendTimeout = null;
let resendCountdown = 60;

// Get email from sessionStorage
document.addEventListener('DOMContentLoaded', () => {
  email = sessionStorage.getItem('resetEmail');

  if (!email) {
    // Redirect back to forgot password if no email
    window.location.href = 'forgot-password.html';
    return;
  }

  // Display partial email
  const emailDisplay = document.getElementById('emailDisplay');
  const partialEmail = email.replace(/(.{2})(.*)(@.*)/, '$1***$3');
  emailDisplay.textContent = `Enter the 6-digit code sent to ${partialEmail}`;

  // Initialize OTP inputs
  initializeOTPInputs();

  // Initialize password toggles
  initializePasswordToggles();

  // Initialize password match checking
  initializePasswordMatch();

  // Start resend timer
  startResendTimer();
});

// Initialize OTP Input Handling
function initializeOTPInputs() {
  const otpInputs = document.querySelectorAll('.otp-digit');

  otpInputs.forEach((input, index) => {
    // Only allow numbers
    input.addEventListener('input', (e) => {
      const value = e.target.value;

      // Only allow digits
      e.target.value = value.replace(/[^0-9]/g, '');

      if (e.target.value.length === 1) {
        input.classList.add('filled');

        // Auto-focus next input
        if (index < otpInputs.length - 1) {
          otpInputs[index + 1].focus();
        }

        // Check if all inputs are filled
        checkOTPComplete();
      } else {
        input.classList.remove('filled');
      }
    });

    // Handle backspace
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !e.target.value && index > 0) {
        otpInputs[index - 1].focus();
        otpInputs[index - 1].value = '';
        otpInputs[index - 1].classList.remove('filled');
      }
    });

    // Handle paste
    input.addEventListener('paste', (e) => {
      e.preventDefault();
      const pastedData = e.clipboardData.getData('text').trim();

      if (/^\d{6}$/.test(pastedData)) {
        // Fill all inputs
        for (let i = 0; i < 6; i++) {
          otpInputs[i].value = pastedData[i];
          otpInputs[i].classList.add('filled');
        }
        otpInputs[5].focus();
        checkOTPComplete();
      }
    });
  });

  // Focus first input
  otpInputs[0].focus();
}

// Check if OTP is complete and verify
async function checkOTPComplete() {
  const otpInputs = document.querySelectorAll('.otp-digit');
  const otp = Array.from(otpInputs).map(input => input.value).join('');

  if (otp.length === 6) {
    // Verify OTP
    await verifyOTP(otp);
  }
}

// Verify OTP
async function verifyOTP(otp) {
  const submitBtn = document.getElementById('submitBtn');
  const errorMessage = document.getElementById('errorMessage');
  const successMessage = document.getElementById('successMessage');

  submitBtn.disabled = true;
  submitBtn.querySelector('.button-text').textContent = 'Verifying...';

  try {
    const response = await fetch('/api/password-reset/verify-otp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, otp })
    });

    const data = await response.json();

    if (response.ok) {
      otpVerified = true;
      showSuccess('Code verified! Enter your new password.');

      // Show password fields
      document.getElementById('passwordFields').style.display = 'block';
      document.getElementById('confirmPasswordGroup').style.display = 'block';

      // Update button text
      submitBtn.querySelector('.button-text').textContent = 'Reset Password';
      submitBtn.disabled = false;

      // Store OTP for password reset
      sessionStorage.setItem('resetOTP', otp);
    } else {
      showError(data.message || 'Invalid code. Please try again.');
      clearOTPInputs();
      submitBtn.disabled = false;
      submitBtn.querySelector('.button-text').textContent = 'Verify Code';
    }
  } catch (error) {
    console.error('Error:', error);
    showError('Network error. Please try again.');
    clearOTPInputs();
    submitBtn.disabled = false;
    submitBtn.querySelector('.button-text').textContent = 'Verify Code';
  }
}

// Clear OTP inputs
function clearOTPInputs() {
  const otpInputs = document.querySelectorAll('.otp-digit');
  otpInputs.forEach(input => {
    input.value = '';
    input.classList.remove('filled');
  });
  otpInputs[0].focus();
}

// Initialize Password Toggles
function initializePasswordToggles() {
  const passwordToggle = document.getElementById('passwordToggle');
  const passwordInput = document.getElementById('newPassword');
  const confirmPasswordToggle = document.getElementById('confirmPasswordToggle');
  const confirmPasswordInput = document.getElementById('confirmPassword');

  passwordToggle.addEventListener('click', () => {
    const type = passwordInput.type === 'password' ? 'text' : 'password';
    passwordInput.type = type;
    passwordToggle.classList.toggle('active');
  });

  confirmPasswordToggle.addEventListener('click', () => {
    const type = confirmPasswordInput.type === 'password' ? 'text' : 'password';
    confirmPasswordInput.type = type;
    confirmPasswordToggle.classList.toggle('active');
  });
}

// Initialize Password Match Checking
function initializePasswordMatch() {
  const newPassword = document.getElementById('newPassword');
  const confirmPassword = document.getElementById('confirmPassword');
  const matchIndicator = document.getElementById('matchIndicator');

  function checkMatch() {
    if (confirmPassword.value && newPassword.value) {
      if (confirmPassword.value === newPassword.value) {
        matchIndicator.classList.add('show');
        confirmPassword.parentElement.classList.add('match');
        confirmPassword.parentElement.classList.remove('no-match');
      } else {
        matchIndicator.classList.remove('show');
        confirmPassword.parentElement.classList.add('no-match');
        confirmPassword.parentElement.classList.remove('match');
      }
    } else {
      matchIndicator.classList.remove('show');
      confirmPassword.parentElement.classList.remove('match', 'no-match');
    }
  }

  newPassword.addEventListener('input', checkMatch);
  confirmPassword.addEventListener('input', checkMatch);
}

// Form Submit Handler
document.getElementById('resetPasswordForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  if (!otpVerified) {
    // If OTP not verified yet, verify it
    const otpInputs = document.querySelectorAll('.otp-digit');
    const otp = Array.from(otpInputs).map(input => input.value).join('');

    if (otp.length !== 6) {
      showError('Please enter the 6-digit code');
      return;
    }

    await verifyOTP(otp);
    return;
  }

  // Reset password
  const newPassword = document.getElementById('newPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;
  const otp = sessionStorage.getItem('resetOTP');

  if (!newPassword || !confirmPassword) {
    showError('Please enter your new password');
    return;
  }

  if (newPassword.length < 6) {
    showError('Password must be at least 6 characters long');
    return;
  }

  if (newPassword !== confirmPassword) {
    showError('Passwords do not match');
    return;
  }

  const submitBtn = document.getElementById('submitBtn');
  submitBtn.disabled = true;
  submitBtn.querySelector('.button-text').textContent = 'Resetting...';

  try {
    const response = await fetch('/api/password-reset/reset', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, otp, newPassword })
    });

    const data = await response.json();

    if (response.ok) {
      showSuccess(data.message);

      // Clear session storage
      sessionStorage.removeItem('resetEmail');
      sessionStorage.removeItem('resetOTP');

      // Redirect to login after 2 seconds
      setTimeout(() => {
        window.location.href = 'login.html';
      }, 2000);
    } else {
      showError(data.message || 'Failed to reset password');
      submitBtn.disabled = false;
      submitBtn.querySelector('.button-text').textContent = 'Reset Password';
    }
  } catch (error) {
    console.error('Error:', error);
    showError('Network error. Please try again.');
    submitBtn.disabled = false;
    submitBtn.querySelector('.button-text').textContent = 'Reset Password';
  }
});

// Resend OTP
document.getElementById('resendLink').addEventListener('click', async (e) => {
  e.preventDefault();

  const resendLink = document.getElementById('resendLink');
  if (resendLink.classList.contains('disabled')) {
    return;
  }

  resendLink.classList.add('disabled');

  try {
    const response = await fetch('/api/password-reset/resend-otp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email })
    });

    const data = await response.json();

    if (response.ok) {
      showSuccess(data.message);
      clearOTPInputs();
      otpVerified = false;

      // Hide password fields
      document.getElementById('passwordFields').style.display = 'none';
      document.getElementById('confirmPasswordGroup').style.display = 'none';

      // Reset button
      const submitBtn = document.getElementById('submitBtn');
      submitBtn.querySelector('.button-text').textContent = 'Verify Code';
      submitBtn.disabled = false;

      // Restart timer
      startResendTimer();
    } else {
      showError(data.message || 'Failed to resend code');
      resendLink.classList.remove('disabled');
    }
  } catch (error) {
    console.error('Error:', error);
    showError('Network error. Please try again.');
    resendLink.classList.remove('disabled');
  }
});

// Resend Timer
function startResendTimer() {
  const resendLink = document.getElementById('resendLink');
  const timer = document.getElementById('timer');

  resendCountdown = 60;
  resendLink.classList.add('disabled');

  if (resendTimeout) {
    clearInterval(resendTimeout);
  }

  resendTimeout = setInterval(() => {
    resendCountdown--;
    timer.textContent = `(${resendCountdown}s)`;

    if (resendCountdown <= 0) {
      clearInterval(resendTimeout);
      timer.textContent = '';
      resendLink.classList.remove('disabled');
    }
  }, 1000);
}

// Show Error Message
function showError(message) {
  const errorMessage = document.getElementById('errorMessage');
  const successMessage = document.getElementById('successMessage');
  errorMessage.textContent = message;
  successMessage.textContent = '';
  errorMessage.style.display = 'block';
  setTimeout(() => {
    errorMessage.style.display = 'none';
  }, 5000);
}

// Show Success Message
function showSuccess(message) {
  const successMessage = document.getElementById('successMessage');
  const errorMessage = document.getElementById('errorMessage');
  successMessage.textContent = message;
  errorMessage.textContent = '';
  successMessage.style.display = 'block';
}
