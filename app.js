class PokemonApp {
    constructor() {
        this.apiURL = 'https://pokeapi.co/api/v2/pokemon';
        this.pokemonPerPage = 24;
        this.currentPage = 1;
        this.totalPokemon = 0;
        this.favorites = this.loadFromStorage('favorites') || [];
        this.recentSearches = this.loadFromStorage('recentSearches') || [];
        this.currentPokemonList = [];
        this.allPokemonIndex = [];
        this.isFilterActive = false;
        this.filteredNames = [];

        this.init();
    }

    init() {
        this.bindEvents();
        this.fetchTotalPokemon();
        this.loadPokemonPage();
        this.renderFavorites();
        this.renderRecentSearches();
        this.updateBadges();
  }

  bindEvents() {
    const searchBtn = document.getElementById('searchBtn');
    const searchInput = document.getElementById('searchInput');
    if (searchBtn) {
      searchBtn.addEventListener('click', () => this.handleSearch());
    }
    if (searchInput) {
      searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleSearch();
        });
      // Global client-side filter while typing
      searchInput.addEventListener('input', async (e) => {
        const term = e.target.value.trim();
        await this.applyGlobalFilter(term);
      });
    }

    document.getElementById('pagination').addEventListener('click', async (e) => {
      if (e.target.dataset.page) {
        this.currentPage = parseInt(e.target.dataset.page);
        if (this.isFilterActive) {
          await this.loadFilteredPage();
        } else {
          await this.loadPokemonPage();
        }
      }
    });
  }

    async fetchTotalPokemon() {
        const res = await fetch(`${this.apiURL}?limit=1`);
        const data = await res.json();
        this.totalPokemon = data.count;
    }

    async loadPokemonPage() {
        const offset = (this.currentPage - 1) * this.pokemonPerPage;
        const res = await fetch(`${this.apiURL}?limit=${this.pokemonPerPage}&offset=${offset}`);
        const data = await res.json();

        const promises = data.results.map(p => fetch(p.url).then(r => r.json()));
        const pokemonList = await Promise.all(promises);

        // Store current page list and render depending on filter state
        this.currentPokemonList = pokemonList;
        if (this.isFilterActive) {
            await this.loadFilteredPage();
        } else {
            this.renderPokemonCards(pokemonList);
            this.renderPagination();
        }
    }

    renderPokemonCards(pokemonList) {
        const container = document.getElementById('pokemonList');
        container.innerHTML = '';

        pokemonList.forEach(pokemon => {
            const isFav = this.favorites.includes(pokemon.name);
            const card = document.createElement('div');
            card.className = 'pokemon-card';
            card.innerHTML = `
                <button class="favorite-toggle${isFav ? ' is-fav' : ''}" data-name="${pokemon.name}" aria-pressed="${isFav}" title="${isFav ? 'Quitar de favoritos' : 'Agregar a favoritos'}" onclick="app.toggleCardFavorite(this, '${pokemon.name}')">${isFav ? '❤' : '♡'}</button>
                <img src="${pokemon.sprites.other['official-artwork'].front_default}" alt="${pokemon.name}">
                <h3>${pokemon.name}</h3>
                <button onclick="app.showPokemonDetail('${pokemon.name}')">Ver Detalles</button>
            `;
            container.appendChild(card);
        });
    }

    // Ensure full index of all Pokémon names/urls is loaded once
    async ensureAllIndex() {
        if (this.allPokemonIndex.length) return;
        const res = await fetch(`${this.apiURL}?limit=100000&offset=0`);
        const data = await res.json();
        this.allPokemonIndex = data.results; // [{ name, url }]
        if (!this.totalPokemon) this.totalPokemon = data.count;
    }

    // Global client-side filter across all Pokémon with pagination
    async applyGlobalFilter(term) {
        const normalized = term.toLowerCase();
        if (!normalized) {
            this.isFilterActive = false;
            this.currentPage = 1;
            await this.loadPokemonPage();
            return;
        }
        await this.ensureAllIndex();
        this.isFilterActive = true;
        this.currentPage = 1;
        this.filteredNames = this.allPokemonIndex
            .filter(p => p.name.toLowerCase().includes(normalized))
            .map(p => p.name);
        await this.loadFilteredPage();
    }

    // Load and render current page of filtered names
    async loadFilteredPage() {
        const start = (this.currentPage - 1) * this.pokemonPerPage;
        const end = start + this.pokemonPerPage;
        const namesSlice = this.filteredNames.slice(start, end);
        const details = await Promise.all(
            namesSlice.map(name => fetch(`${this.apiURL}/${name}`).then(r => r.json()))
        );
        this.renderPokemonCards(details);
        this.renderPagination();
    }

    renderPagination() {
        const totalItems = this.isFilterActive ? this.filteredNames.length : this.totalPokemon;
        const totalPages = Math.ceil(totalItems / this.pokemonPerPage) || 1;
        const container = document.getElementById('pagination');
        container.innerHTML = '';

        const pages = ['Primero', 'Anterior', ...Array.from({ length: totalPages }, (_, i) => i + 1), 'Siguiente', 'Último'];

        pages.forEach(label => {
            let pageNum;
            if (label === 'Primero') pageNum = 1;
            else if (label === 'Anterior') pageNum = Math.max(1, this.currentPage - 1);
            else if (label === 'Siguiente') pageNum = Math.min(totalPages, this.currentPage + 1);
            else if (label === 'Último') pageNum = totalPages;
            else pageNum = label;

            const btn = document.createElement('button');
            btn.textContent = label;
            btn.dataset.page = pageNum;
            if (pageNum === this.currentPage) btn.classList.add('active');
            container.appendChild(btn);
        });
    }

    async showPokemonDetail(name) {
        try {
            const res = await fetch(`${this.apiURL}/${name.toLowerCase()}`);
            if (!res.ok) throw new Error('404');

            const pokemon = await res.json();
            this.addRecentSearch(name);
            this.renderPokemonDetail(pokemon);
        } catch (err) {
            this.showError('Pokémon no encontrado ❌');
        }
    }

    renderPokemonDetail(pokemon) {
        const detail = document.getElementById('pokemonDetail');
        const isFav = this.favorites.includes(pokemon.name);
        detail.innerHTML = `
            <div class="detail-header">
              <button class="back-btn" onclick="app.clearPokemonDetail()">← Volver</button>
              <button class="favorite-toggle detail-fav${isFav ? ' is-fav' : ''}" aria-pressed="${isFav}" title="${isFav ? 'Quitar de favoritos' : 'Agregar a favoritos'}" onclick="app.toggleDetailFavorite(this, '${pokemon.name}')">${isFav ? '❤' : '♡'}</button>
            </div>
            <h2>${pokemon.name} (#${pokemon.id})</h2>
            <img src="${pokemon.sprites.other['official-artwork'].front_default}" alt="${pokemon.name}">
            <p><strong>Tipos:</strong> ${pokemon.types.map(t => t.type.name).join(', ')}</p>
            <p><strong>Altura:</strong> ${pokemon.height / 10} m</p>
            <p><strong>Peso:</strong> ${pokemon.weight / 10} kg</p>
            <p><strong>Habilidades:</strong> ${pokemon.abilities.map(a => a.ability.name).join(', ')}</p>
        `;
    }

    clearPokemonDetail() {
        const detail = document.getElementById('pokemonDetail');
        detail.innerHTML = '';
    detail.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

    handleSearch() {
        const input = document.getElementById('searchInput').value.trim();
        if (input) this.showPokemonDetail(input);
    }

    toggleFavorite(name) {
        if (this.favorites.includes(name)) {
            this.favorites = this.favorites.filter(f => f !== name);
        } else {
            if (this.favorites.length >= 50) this.favorites.shift();
            this.favorites.push(name);
        }
        this.saveToStorage('favorites', this.favorites);
        this.renderFavorites();
    }

    renderFavorites() {
        const container = document.getElementById('favorites');
        container.innerHTML = '';
        [...this.favorites].reverse().forEach(name => {
            const item = document.createElement('li');
            item.textContent = name;
            item.onclick = () => this.showPokemonDetail(name);
            container.appendChild(item);
        });
        this.updateFavoritesBadge();
    }

    addRecentSearch(name) {
        this.recentSearches = this.recentSearches.filter(n => n !== name);
        this.recentSearches.unshift(name);
        if (this.recentSearches.length > 10) this.recentSearches.pop();
        this.saveToStorage('recentSearches', this.recentSearches);
        this.renderRecentSearches();
    }

    renderRecentSearches() {
        const container = document.getElementById('recentSearches');
        container.innerHTML = '';
        this.recentSearches.forEach(name => {
            const item = document.createElement('li');
            item.textContent = name;
            item.onclick = () => this.showPokemonDetail(name);
            container.appendChild(item);
        });
        this.updateRecentBadge();
    }

    showError(message) {
        const status = document.getElementById('status');
        status.textContent = message;
        status.className = 'error';
        setTimeout(() => status.textContent = '', 3000);
    }

    saveToStorage(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    }

    loadFromStorage(key) {
        return JSON.parse(localStorage.getItem(key));
    }

    // Card favorite toggle helper for UI sync
    toggleCardFavorite(buttonEl, name) {
        this.toggleFavorite(name);
        const isFavNow = this.favorites.includes(name);
        buttonEl.classList.toggle('is-fav', isFavNow);
        buttonEl.setAttribute('aria-pressed', String(isFavNow));
        buttonEl.textContent = isFavNow ? '❤' : '♡';
        buttonEl.title = isFavNow ? 'Quitar de favoritos' : 'Agregar a favoritos';

        // Sync detail heart if detail view is open
        const detailHeart = document.querySelector('.detail-section .favorite-toggle.detail-fav');
        const detailTitle = document.querySelector('.detail-section h2');
        if (detailHeart && detailTitle && detailTitle.textContent?.toLowerCase().includes(name.toLowerCase())) {
            detailHeart.classList.toggle('is-fav', isFavNow);
            detailHeart.setAttribute('aria-pressed', String(isFavNow));
            detailHeart.textContent = isFavNow ? '❤' : '♡';
            detailHeart.title = isFavNow ? 'Quitar de favoritos' : 'Agregar a favoritos';
        }
    }

    // Badge helpers
    updateBadges() {
        this.updateFavoritesBadge();
        this.updateRecentBadge();
    }

    updateFavoritesBadge() {
        const el = document.getElementById('favoritesCount');
        if (el) el.textContent = String(this.favorites.length);
    }

    updateRecentBadge() {
        const el = document.getElementById('recentCount');
        if (el) el.textContent = String(this.recentSearches.length);
    }

    // Detail favorite toggle helper for UI sync
    toggleDetailFavorite(buttonEl, name) {
        this.toggleFavorite(name);
        const isFavNow = this.favorites.includes(name);
        buttonEl.classList.toggle('is-fav', isFavNow);
        buttonEl.setAttribute('aria-pressed', String(isFavNow));
        buttonEl.textContent = isFavNow ? '❤' : '♡';
        buttonEl.title = isFavNow ? 'Quitar de favoritos' : 'Agregar a favoritos';

        // Sync card heart on grid if present
        const cardHeart = document.querySelector(`.pokemon-card .favorite-toggle[data-name="${name}"]`);
        if (cardHeart) {
            cardHeart.classList.toggle('is-fav', isFavNow);
            cardHeart.setAttribute('aria-pressed', String(isFavNow));
            cardHeart.textContent = isFavNow ? '❤' : '♡';
            cardHeart.title = isFavNow ? 'Quitar de favoritos' : 'Agregar a favoritos';
        }
    }
}

const app = new PokemonApp();