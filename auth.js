document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const messageElement = document.getElementById('message');

    // Helper function to display messages
    const displayMessage = (message, isError = true) => {
        if (messageElement) {
            messageElement.textContent = message;
            messageElement.style.color = isError ? '#f44336' : '#4CAF50';
        }
    };

    // Handle Login
    if (loginForm) {
        loginForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const emailOrUsername = document.getElementById('emailOrUsername').value;
            const password = document.getElementById('password').value;

            try {
                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ emailOrUsername, password }),
                });

                const data = await response.json();

                if (response.ok) {
                    displayMessage(data.message || 'ログイン成功！', false);
                    setTimeout(() => {
                        window.location.href = '/'; // Redirect to home page
                    }, 1500);
                } else {
                    displayMessage(data.error || 'ログイン失敗。');
                }
            } catch (error) {
                console.error('Network error during login:', error);
                displayMessage('ネットワークエラーが発生しました。');
            }
        });
    }

    // Handle Register
    if (registerForm) {
        registerForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const email = document.getElementById('email').value;
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;

            try {
                const response = await fetch('/api/auth/register', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ email, username, password }),
                });

                const data = await response.json();

                if (response.ok) {
                    displayMessage(data.message || '登録成功！ログインページへ移動します。', false);
                    setTimeout(() => {
                        window.location.href = '/login.html'; // Redirect to login page
                    }, 2000);
                } else {
                    displayMessage(data.error || '登録失敗。');
                }
            } catch (error) {
                console.error('Network error during registration:', error);
                displayMessage('ネットワークエラーが発生しました。');
            }
        });
    }
});