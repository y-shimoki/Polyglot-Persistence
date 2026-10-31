document.addEventListener("DOMContentLoaded", () => {
  const searchBar = document.getElementById("searchBar");
  
  if (searchBar) {
    searchBar.addEventListener("keyup", (e) => {
      const term = e.target.value.toLowerCase();
      const cards = document.querySelectorAll(".book-card");
      
      cards.forEach(card => {
        const title = card.querySelector("h3").textContent.toLowerCase();
        if (title.includes(term)) {
          card.style.display = "flex";
        } else {
          card.style.display = "none";
        }
      });
    });
  }
});