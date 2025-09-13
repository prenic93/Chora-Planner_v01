const toast = document.getElementById('toast');
const loading = document.getElementById('loading');

export function showToast(message, type = 'success') {
    toast.textContent = message;
    toast.className = `toast show ${type}`;
    setTimeout(() => {
        toast.className = toast.className.replace('show', '');
    }, 3000);
}

export function showLoading(show) {
    loading.style.display = show ? 'flex' : 'none';
}

export function openModal(id) {
    document.getElementById(id).style.display = 'flex';
    setTimeout(() => document.getElementById(id).classList.add('show'), 10);
}

export function closeModal(id) {
    const modal = document.getElementById(id);
    modal.classList.remove('show');
    setTimeout(() => modal.style.display = 'none', 300);
}
