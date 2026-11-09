export function showToast(message: string): void {
  const toast = document.getElementById("toast");
  if (!toast) return;

  toast.textContent = message;
  toast.style.display = "block";
  window.clearTimeout(Number(toast.dataset.timer));
  toast.dataset.timer = String(
    window.setTimeout(() => {
      toast.style.display = "none";
    }, 6000)
  );
}
