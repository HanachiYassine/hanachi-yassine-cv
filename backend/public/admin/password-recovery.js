(() => {
    const byId = id => document.getElementById(id);
    let resetToken = new URLSearchParams(location.hash.slice(1)).get('token') || '';
    const form = byId('resetPasswordForm');
    if (form) history.replaceState(null, '', location.pathname);
    const message = byId('recoveryMessage');

    function display(text, error = false) {
        message.textContent = text;
        message.classList.toggle('recovery__message--error', error);
    }

    async function post(path, body) {
        const response = await fetch('/api/admin/' + path, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body), cache: 'no-store', referrerPolicy: 'no-referrer'
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'La demande a échoué.');
        return result.message;
    }

    async function submit(button, work) {
        button.disabled = true;
        display('En cours…');
        try { display(await work()); }
        catch (failure) { display(failure.message || 'Erreur de connexion. Réessayez.', true); }
        finally { button.disabled = !!form && !resetToken; }
    }

    function openRecovery() {
        byId('login-view').hidden = true;
        byId('forgotPasswordView').hidden = false;
        byId('sendResetLink').focus();
    }

    function closeRecovery() {
        byId('forgotPasswordView').hidden = true;
        byId('login-view').hidden = false;
        byId('email').focus();
    }

    async function changePassword() {
        const password = byId('newPassword').value;
        const confirmation = byId('passwordConfirmation').value;
        if (password !== confirmation) throw new Error('Les deux mots de passe doivent être identiques.');
        const result = await post('reset-password', { token: resetToken, password, confirmation });
        resetToken = '';
        sessionStorage.removeItem('cv-admin-token');
        form.reset();
        form.hidden = true;
        return result;
    }

    function initializeReset() {
        if (!/^[a-f0-9]{64}$/.test(resetToken)) {
            resetToken = '';
            form.hidden = true;
            display('Ce lien est invalide. Retournez à la connexion pour demander un nouveau lien.', true);
        }
        form.onsubmit = event => {
            event.preventDefault();
            submit(byId('resetPasswordButton'), changePassword);
        };
    }

    function initializeRequest() {
        byId('forgotPasswordButton').onclick = openRecovery;
        byId('backToLogin').onclick = closeRecovery;
        byId('sendResetLink').onclick = () => submit(byId('sendResetLink'), () => post('forgot-password', {}));
    }

    if (form) initializeReset();
    else initializeRequest();
})();
