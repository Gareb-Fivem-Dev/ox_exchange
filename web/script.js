const resourceName = typeof GetParentResourceName === 'function' ? GetParentResourceName() : 'item_exchange';
const body = document.body;
const panel = document.querySelector('.panel');
const eyebrow = document.querySelector('.eyebrow');
const title = document.querySelector('#menu-title');
const headerInfo = document.querySelector('.panel__header > div');
const tradeList = document.querySelector('#trade-list');
const closeButton = document.querySelector('#close-button');
const minimizeButton = document.querySelector('#minimize-button');

const fivemBlipSprites = [
    { id: 1, label: 'Standard' },
    { id: 52, label: 'Store' },
    { id: 67, label: 'Car' },
    { id: 68, label: 'Truck' },
    { id: 71, label: 'Helicopter' },
    { id: 76, label: 'Barber' },
    { id: 93, label: 'Clothing' },
    { id: 106, label: 'Police' },
    { id: 108, label: 'Hospital' },
    { id: 110, label: 'Ammu-Nation' },
    { id: 226, label: 'Garage' },
    { id: 280, label: 'Person' },
    { id: 351, label: 'Dollar Sign' },
    { id: 408, label: 'Casino' },
    { id: 431, label: 'Warehouse' },
    { id: 500, label: 'Crate' },
    { id: 605, label: 'Handshake' },
    { id: 617, label: 'Toolbox' },
    { id: 628, label: 'Shop Basket' }
];

let trades = [];
let buyers = [];
let adminItems = [];
let editingTrade = null;
let editingBuyer = null;
let editingPed = null;
let adminPeds = [];
let pedAdminPeds = [];
let vehicleSpawnerCerts = [];
let vehicleSpawnerVehicles = [];
let activeAdminTab = 'trades';
let activeBuyerAdminTab = 'offers';
let activeVehicleAdminTab = 'licenses';
let activeBuyerItemFilter = '';
let buyerSearchQuery = '';
let vehicleAdminFormCache = null;
let pedAdminFormCache = null;
let editingCert = null;
let editingVehicle = null;

let adminHubPermissions = {};
let adminHubBuiltIn = [];
let adminHubCategories = [];
let adminHubCustomCommands = [];
let adminHubActiveCategory = null;
let adminHubDebug = false;

function postNui(eventName, data = {}) {
    if (adminHubDebug) console.log('[AdminHub] postNui:', eventName, data);
    return fetch(`https://${resourceName}/${eventName}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json; charset=UTF-8'
        },
        body: JSON.stringify(data)
    });
}

function closeMenu() {
    body.classList.remove('is-open');
    body.classList.remove('is-admin');
    body.classList.remove('is-buyer');
    body.classList.remove('is-buyer-admin');
    body.classList.remove('is-ped-admin');
    body.classList.remove('is-vehicle-admin');
    body.classList.remove('is-admin-hub');
    panel.setAttribute('aria-hidden', 'true');
    clearBuyerHeaderSearch();
    vehicleAdminFormCache = null;
    pedAdminFormCache = null;
    editingCert = null;
    editingVehicle = null;
    minimizeButton.style.display = 'none';
    document.getElementById('admin-hub-modal').classList.remove('visible');
    document.getElementById('admin-hub-confirm-modal').classList.remove('visible');
    postNui('close');
}

function openPanel() {
    body.classList.add('is-open');
    panel.setAttribute('aria-hidden', 'false');
}

function createTradeCard(trade) {
    const card = document.createElement('article');
    card.className = 'trade-card';

    const heading = document.createElement('div');
    heading.innerHTML = `
        <h2 class="trade-card__title"></h2>
        <p class="trade-card__description"></p>
    `;
    heading.querySelector('h2').textContent = trade.label;
    heading.querySelector('p').textContent = trade.description;

    const swap = document.createElement('div');
    swap.className = 'trade-card__swap';
    swap.innerHTML = `
        <div class="pill"><img alt=""><div><strong></strong><span></span></div></div>
        <span class="arrow">to</span>
        <div class="pill"><img alt=""><div><strong></strong><span></span></div></div>
    `;

    const pills = swap.querySelectorAll('.pill');
    const costLabel = trade.cost.label || trade.cost.item;
    const receiveLabel = trade.receive.label || trade.receive.item;

    const costImage = pills[0].querySelector('img');
    const receiveImage = pills[1].querySelector('img');

    costImage.src = trade.cost.image;
    costImage.alt = costLabel;
    costImage.addEventListener('error', () => costImage.classList.add('is-hidden'));
    pills[0].querySelector('strong').textContent = `${trade.cost.count}x`;
    pills[0].querySelector('span').textContent = costLabel;
    receiveImage.src = trade.receive.image;
    receiveImage.alt = receiveLabel;
    receiveImage.addEventListener('error', () => receiveImage.classList.add('is-hidden'));
    pills[1].querySelector('strong').textContent = `${trade.receive.formula || trade.receive.count}x`;
    pills[1].querySelector('span').textContent = receiveLabel;

    const controls = document.createElement('div');
    controls.className = 'trade-card__controls';
    controls.innerHTML = `
        <label>
            Amount
            <input type="number" min="1" step="1" value="1" inputmode="numeric">
        </label>
        <button class="trade-button" type="button">Trade</button>
    `;

    const amountInput = controls.querySelector('input');
    const tradeButton = controls.querySelector('button');

    const defaultTradeAmount = Math.floor(Number(trade.owned || 0) / Math.max(1, Number(trade.cost.count || 1)));
    if (defaultTradeAmount > 0) {
        amountInput.value = String(defaultTradeAmount);
        amountInput.max = String(defaultTradeAmount);
    }

    function updateTradeState() {
        const amount = Math.max(1, Math.floor(Number(amountInput.value) || 1));
        const owned = Number(trade.owned || 0);
        const required = Number(trade.cost.count || 1) * amount;
        const canTrade = owned >= required;

        tradeButton.disabled = !canTrade;
    tradeButton.textContent = canTrade ? 'Trade' : 'Missing';
    tradeButton.title = canTrade ? '' : `Missing item: ${owned}/${required} ${costLabel}.`;
        card.classList.toggle('is-unavailable', !canTrade);
    }

    amountInput.addEventListener('input', updateTradeState);
    updateTradeState();

    tradeButton.addEventListener('click', () => {
        const amount = Math.floor(Number(amountInput.value));

        if (!Number.isFinite(amount) || amount < 1) {
            amountInput.value = '1';
            return;
        }

        postNui('trade', {
            index: trade.index,
            amount
        });
    });

    card.append(heading, swap, controls);
    return card;
}

function renderTrades() {
    body.classList.remove('is-admin');
    body.classList.remove('is-buyer');
    body.classList.remove('is-buyer-admin');
    body.classList.remove('is-ped-admin');
    body.classList.remove('is-vehicle-admin');
    body.classList.remove('is-admin-hub');
    minimizeButton.style.display = 'none';
    clearBuyerHeaderSearch();
    eyebrow.textContent = '';
    tradeList.className = 'trade-list';
    tradeList.replaceChildren(...trades.map(createTradeCard));
}

function normalizeBuyerSearch(value) {
    return String(value || '').trim().toLowerCase();
}

function getBuyerSearchText(buyer) {
    const itemName = buyer?.item?.name || '';
    const itemLabel = buyer?.item?.label || '';
    const buyerLabel = buyer?.label || '';

    return `${buyerLabel} ${itemLabel} ${itemName}`.toLowerCase();
}

function createBuyerSearchBar() {
    const wrapper = document.createElement('div');
    wrapper.className = 'buyer-header-search';
    wrapper.innerHTML = '<input type="text" placeholder="Search item to sell" autocomplete="off">';

    const input = wrapper.querySelector('input');
    input.value = buyerSearchQuery;
    input.addEventListener('input', () => {
        buyerSearchQuery = input.value;
        applyBuyerSearchFilter();
    });

    return wrapper;
}

function clearBuyerHeaderSearch() {
    const existingSearch = headerInfo?.querySelector('.buyer-header-search');

    if (existingSearch) {
        existingSearch.remove();
    }
}

function renderBuyerHeaderSearch() {
    clearBuyerHeaderSearch();

    if (!headerInfo) {
        return;
    }

    headerInfo.append(createBuyerSearchBar());
}

function applyBuyerSearchFilter() {
    const filter = normalizeBuyerSearch(buyerSearchQuery);
    const cards = tradeList.querySelectorAll('.buyer-card');
    let visibleCount = 0;

    cards.forEach((card) => {
        const matches = !filter || card.dataset.searchText.includes(filter);
        card.classList.toggle('is-hidden', !matches);

        if (matches) {
            visibleCount += 1;
        }
    });

    let emptyState = tradeList.querySelector('.buyer-empty');

    if (!emptyState) {
        emptyState = document.createElement('p');
        emptyState.className = 'buyer-empty';
        emptyState.textContent = 'No matching items found.';
        tradeList.append(emptyState);
    }

    emptyState.classList.toggle('is-hidden', visibleCount > 0 || cards.length === 0);
}

function createBuyerCard(buyer) {
    const card = document.createElement('article');
    card.className = 'trade-card buyer-card';

    const itemLabel = buyer.item.label || buyer.item.name;
    card.dataset.searchText = getBuyerSearchText(buyer);
    card.innerHTML = `
        <h2 class="trade-card__title"></h2>
        <div class="trade-card__swap buyer-card__swap">
            <div class="pill"><img alt=""><div><strong></strong><span></span></div></div>
            <span class="arrow">for</span>
            <div class="pill cash-pill"><div><strong></strong><span></span></div></div>
        </div>
        <div class="trade-card__controls">
            <label>
                Amount
                <input type="number" min="1" step="1" value="1" inputmode="numeric">
            </label>
            <button class="trade-button" type="button">Sell</button>
        </div>
    `;

    card.querySelector('.trade-card__title').textContent = itemLabel;

    const image = card.querySelector('img');
    image.src = buyer.item.image;
    image.alt = itemLabel;
    image.addEventListener('error', () => image.classList.add('is-hidden'));
    card.querySelector('.pill strong').textContent = `${buyer.item.count}x`;
    card.querySelector('.pill span').textContent = '';
    card.querySelector('.cash-pill strong').textContent = `$${buyer.price}`;

    const amountInput = card.querySelector('input');
    const sellButton = card.querySelector('button');

    const defaultSellAmount = Math.floor(Number(buyer.owned || 0) / Math.max(1, Number(buyer.item.count || 1)));
    if (defaultSellAmount > 0) {
        amountInput.value = String(defaultSellAmount);
        amountInput.max = String(defaultSellAmount);
    }

    function updateSellState() {
        const amount = Math.max(1, Math.floor(Number(amountInput.value) || 1));
        const owned = Number(buyer.owned || 0);
        const required = Number(buyer.item.count || 1) * amount;
        const canSell = owned >= required;

        sellButton.disabled = !canSell;
    sellButton.textContent = canSell ? 'Sell' : 'Missing';
    sellButton.title = canSell ? '' : `Missing item: ${owned}/${required} ${itemLabel}.`;
        card.classList.toggle('is-unavailable', !canSell);
    }

    amountInput.addEventListener('input', updateSellState);
    updateSellState();

    sellButton.addEventListener('click', () => {
        const amount = Math.floor(Number(amountInput.value));

        if (!Number.isFinite(amount) || amount < 1) {
            amountInput.value = '1';
            return;
        }

        postNui('buyerSell', {
            index: buyer.index,
            amount
        });
    });

    return card;
}

function renderBuyers() {
    body.classList.remove('is-admin');
    body.classList.remove('is-buyer-admin');
    body.classList.remove('is-ped-admin');
    body.classList.remove('is-vehicle-admin');
    body.classList.remove('is-admin-hub');
    body.classList.add('is-buyer');
    minimizeButton.style.display = 'none';
    renderBuyerHeaderSearch();
    eyebrow.textContent = '';
    tradeList.className = 'trade-list buyer-list';
    tradeList.replaceChildren(...buyers.map(createBuyerCard));
    applyBuyerSearchFilter();
}

function findItem(value) {
    const search = String(value || '').trim().toLowerCase();

    if (!search) {
        return null;
    }

    return adminItems.find((item) => item.name.toLowerCase() === search)
        || adminItems.find((item) => item.label.toLowerCase() === search)
        || null;
}

function getItemDisplay(itemName) {
    const item = findItem(itemName);

    if (!item) {
        return itemName || '';
    }

    return `${item.label} (${item.name})`;
}

function createItemSearch(labelText, onSelect, initialItemName = '') {
    const wrapper = document.createElement('label');
    wrapper.className = 'item-search';
    wrapper.innerHTML = `
        ${labelText}
        <input type="text" autocomplete="off" placeholder="Search item name or label">
        <div class="item-results"></div>
    `;

    const input = wrapper.querySelector('input');
    const results = wrapper.querySelector('.item-results');

    input.value = getItemDisplay(initialItemName);
    onSelect(initialItemName);

    function renderResults() {
        const value = input.value.trim().toLowerCase();

        if (value.length < 1) {
            results.replaceChildren();
            return;
        }

        const matches = adminItems
            .filter((item) => item.label.toLowerCase().includes(value) || item.name.toLowerCase().includes(value))
            .slice(0, 8);

        results.replaceChildren(...matches.map((item) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'item-result';
            button.innerHTML = `
                <img alt="">
                <span></span>
                <code></code>
            `;
            button.querySelector('img').src = item.image;
            button.querySelector('img').alt = item.label;
            button.querySelector('img').addEventListener('error', (event) => event.currentTarget.classList.add('is-hidden'));
            button.querySelector('span').textContent = item.label;
            button.querySelector('code').textContent = item.name;
            button.addEventListener('click', () => {
                input.value = `${item.label} (${item.name})`;
                results.replaceChildren();
                onSelect(item.name);
            });

            return button;
        }));
    }

    input.addEventListener('input', () => {
        const exactItem = findItem(input.value);
        onSelect(exactItem ? exactItem.name : input.value.trim());
        renderResults();
    });

    return wrapper;
}

function createAdminForm(trade = null) {
    const form = document.createElement('form');
    form.className = 'admin-form';
    form.dataset.mode = trade ? 'edit' : 'add';

    let costItem = trade?.cost?.item || '';
    let receiveItem = trade?.receive?.item || '';

    const costSearch = createItemSearch('Cost Item', (itemName) => {
        costItem = itemName;
    }, costItem);
    const receiveSearch = createItemSearch('Receive Item', (itemName) => {
        receiveItem = itemName;
    }, receiveItem);

    form.innerHTML = `
        <h2>${trade ? `Edit Trade #${trade.index}` : 'Add Trade'}</h2>
        <div class="admin-grid">
            <label>Trader ID<input name="trader" type="number" min="1" step="1" value="${trade?.trader || 1}" required></label>
            <label>Label<input name="label" type="text" placeholder="Buy Blacksmith Coal Ore" value="${trade?.label || ''}" required></label>
            <label class="admin-wide">Description<input name="description" type="text" placeholder="Trade coal ore for blacksmith coal ore" value="${trade?.description || ''}"></label>
            <label>Cost Count<input name="costCount" type="number" min="1" step="1" value="${trade?.cost?.count || 1}" required></label>
            <label>Receive Count or Formula<input name="receiveCount" type="text" value="${trade ? trade.receive.formula || trade.receive.count || '' : ''}" placeholder="1, 1-3, random(1,3)" required></label>
            <label>Icon<input name="icon" type="text" value="${trade?.icon || ''}" placeholder="right-left"></label>
        </div>
    `;

    const grid = form.querySelector('.admin-grid');
    grid.insertBefore(costSearch, grid.children[3]);
    grid.insertBefore(receiveSearch, grid.children[4]);

    const submit = document.createElement('button');
    submit.className = 'trade-button admin-submit';
    submit.type = 'submit';
    submit.textContent = trade ? 'Save Trade' : 'Add Trade';
    form.append(submit);

    if (trade) {
        const cancel = document.createElement('button');
        cancel.className = 'mini-button admin-cancel-edit';
        cancel.type = 'button';
        cancel.textContent = 'Cancel Edit';
        cancel.addEventListener('click', () => {
            editingTrade = null;
            renderAdmin();
        });
        form.append(cancel);
    }

    form.addEventListener('submit', (event) => {
        event.preventDefault();

        const formData = new FormData(form);
        const resolvedCost = findItem(costItem)?.name || costItem;
        const resolvedReceive = findItem(receiveItem)?.name || receiveItem;

        if (!resolvedCost || !resolvedReceive) {
            return;
        }

        const payload = {
            trader: formData.get('trader'),
            label: formData.get('label'),
            description: formData.get('description'),
            costItem: resolvedCost,
            costCount: formData.get('costCount'),
            receiveItem: resolvedReceive,
            receiveCount: formData.get('receiveCount'),
            icon: formData.get('icon') || 'right-left'
        };

        if (trade) {
            payload.index = trade.index;
            postNui('adminUpdateTrade', payload);
            return;
        }

        postNui('adminAddTrade', payload);
    });

    return form;
}

function createAdminTradeRow(trade) {
    const row = document.createElement('article');
    row.className = 'admin-trade';
    row.innerHTML = `
        <div>
            <h3></h3>
            <p></p>
        </div>
        <label>Trader<input type="number" min="1" step="1"></label>
        <button type="button" class="mini-button edit-button">Edit</button>
        <button type="button" class="mini-button toggle-button"></button>
        <button type="button" class="mini-button delete-button">Delete</button>
        <div class="delete-confirm" hidden>
            <span></span>
            <button type="button" class="mini-button confirm-delete-button">Confirm</button>
            <button type="button" class="mini-button cancel-delete-button">Cancel</button>
        </div>
    `;

    row.querySelector('h3').textContent = `[${trade.index}] ${trade.label}`;
    row.querySelector('p').textContent = `${trade.enabled ? 'Enabled' : 'Disabled'} - ${trade.cost.count}x ${trade.cost.label} to ${trade.receive.formula || trade.receive.count}x ${trade.receive.label}`;

    const traderInput = row.querySelector('input');
    traderInput.value = trade.trader;
    traderInput.addEventListener('change', () => {
        postNui('adminChangeTrader', {
            index: trade.index,
            trader: traderInput.value
        });
    });

    const toggleButton = row.querySelector('.toggle-button');
    toggleButton.textContent = trade.enabled ? 'Disable' : 'Enable';
    toggleButton.addEventListener('click', () => {
        postNui('adminToggleTrade', { index: trade.index });
    });

    row.querySelector('.edit-button').addEventListener('click', () => {
        editingTrade = trade;
        renderAdmin();
    });

    const deleteConfirm = row.querySelector('.delete-confirm');
    deleteConfirm.querySelector('span').textContent = `Delete ${trade.label}?`;

    row.querySelector('.delete-button').addEventListener('click', () => {
        deleteConfirm.hidden = false;
    });

    row.querySelector('.cancel-delete-button').addEventListener('click', () => {
        deleteConfirm.hidden = true;
    });

    row.querySelector('.confirm-delete-button').addEventListener('click', () => {
        postNui('adminDeleteTrade', { index: trade.index });
        deleteConfirm.hidden = true;
    });

    return row;
}

function createAdminPedRow(ped, index) {
    const row = document.createElement('article');
    row.className = 'admin-ped';
    row.innerHTML = `
        <div>
            <h3></h3>
            <p></p>
        </div>
        <button type="button" class="mini-button teleport-button">Teleport</button>
    `;

    const titleText = ped.menuTitle || ped.targetLabel || `Trader ${ped.trader || index}`;
    const coords = ped.coords || {};

    row.querySelector('h3').textContent = `[${index}] ${titleText}`;
    row.querySelector('p').textContent = `Trader ${ped.trader || 'all'} - ${ped.model || 'ped'} - ${Number(coords.x || 0).toFixed(2)}, ${Number(coords.y || 0).toFixed(2)}, ${Number(coords.z || 0).toFixed(2)}`;

    row.querySelector('.teleport-button').addEventListener('click', () => {
        postNui('adminTeleportPed', { index: ped.configIndex || index });
    });

    return row;
}

function createBuyerAdminForm(buyer = null) {
    const form = document.createElement('form');
    form.className = 'admin-form buyer-admin-form';
    form.dataset.mode = buyer ? 'edit' : 'add';

    let itemName = buyer?.item?.name || '';
    const itemSearch = createItemSearch('Item To Buy', (selectedItem) => {
        itemName = selectedItem;
    }, itemName);

    form.innerHTML = `
        <h2>${buyer ? `Edit Buyer Offer #${buyer.index}` : 'Add Buyer Offer'}</h2>
        <div class="admin-grid">
            <label>Buyer ID<input name="buyer" type="number" min="1" step="1" value="${buyer?.buyer || 1}" required></label>
            <label>Label<input name="label" type="text" placeholder="Sell Steel Ingot" value="${buyer?.label || ''}" required></label>
            <label class="admin-wide">Description<input name="description" type="text" placeholder="Sell steel ingots for cash" value="${buyer?.description || ''}"></label>
            <label>Item Count<input name="count" type="number" min="1" step="1" value="${buyer?.item?.count || 1}" required></label>
            <label>Cash Price<input name="price" type="number" min="1" step="1" value="${buyer?.price || 1}" required></label>
        </div>
    `;

    const grid = form.querySelector('.admin-grid');
    grid.insertBefore(itemSearch, grid.children[3]);

    const submit = document.createElement('button');
    submit.className = 'trade-button admin-submit';
    submit.type = 'submit';
    submit.textContent = buyer ? 'Save Buyer Offer' : 'Add Buyer Offer';
    form.append(submit);

    if (buyer) {
        const cancel = document.createElement('button');
        cancel.className = 'mini-button admin-cancel-edit';
        cancel.type = 'button';
        cancel.textContent = 'Cancel Edit';
        cancel.addEventListener('click', () => {
            editingBuyer = null;
            renderBuyerAdmin();
        });
        form.append(cancel);
    }

    form.addEventListener('submit', (event) => {
        event.preventDefault();

        const formData = new FormData(form);
        const resolvedItem = findItem(itemName)?.name || itemName;

        if (!resolvedItem) {
            return;
        }

        const payload = {
            buyer: formData.get('buyer'),
            label: formData.get('label'),
            description: formData.get('description'),
            item: resolvedItem,
            count: formData.get('count'),
            price: formData.get('price')
        };

        if (buyer) {
            payload.index = buyer.index;
            postNui('buyerAdminUpdateOffer', payload);
            return;
        }

        postNui('buyerAdminAddOffer', payload);
    });

    return form;
}

function createBuyerAdminRow(buyer) {
    const row = document.createElement('article');
    row.className = 'admin-trade buyer-admin-offer';
    row.innerHTML = `
        <div>
            <h3></h3>
            <p></p>
        </div>
        <label>Buyer<input type="number" min="1" step="1"></label>
        <button type="button" class="mini-button edit-button">Edit</button>
        <button type="button" class="mini-button toggle-button"></button>
        <button type="button" class="mini-button delete-button">Delete</button>
        <div class="delete-confirm" hidden>
            <span></span>
            <button type="button" class="mini-button confirm-delete-button">Confirm</button>
            <button type="button" class="mini-button cancel-delete-button">Cancel</button>
        </div>
    `;

    row.querySelector('h3').textContent = `[${buyer.index}] ${buyer.label}`;
    row.querySelector('p').textContent = `${buyer.enabled ? 'Enabled' : 'Disabled'} - buys ${buyer.item.count}x ${buyer.item.label} for $${buyer.price}`;

    const buyerInput = row.querySelector('input');
    buyerInput.value = buyer.buyer;
    buyerInput.addEventListener('change', () => {
        postNui('buyerAdminChangeBuyer', {
            index: buyer.index,
            buyer: buyerInput.value
        });
    });

    const toggleButton = row.querySelector('.toggle-button');
    toggleButton.textContent = buyer.enabled ? 'Disable' : 'Enable';
    toggleButton.addEventListener('click', () => {
        postNui('buyerAdminToggleOffer', { index: buyer.index });
    });

    row.querySelector('.edit-button').addEventListener('click', () => {
        editingBuyer = buyer;
        renderBuyerAdmin();
    });

    const deleteConfirm = row.querySelector('.delete-confirm');
    deleteConfirm.querySelector('span').textContent = `Delete ${buyer.label}?`;

    row.querySelector('.delete-button').addEventListener('click', () => {
        deleteConfirm.hidden = false;
    });

    row.querySelector('.cancel-delete-button').addEventListener('click', () => {
        deleteConfirm.hidden = true;
    });

    row.querySelector('.confirm-delete-button').addEventListener('click', () => {
        postNui('buyerAdminDeleteOffer', { index: buyer.index });
        deleteConfirm.hidden = true;
    });

    return row;
}

function getBuyerIdsFromOffers() {
    return [...new Set(buyers.map((buyer) => Number(buyer.buyer)).filter((buyerId) => Number.isFinite(buyerId) && buyerId >= 1))]
        .sort((left, right) => left - right);
}

function createBuyerItemsPanel() {
    const buyerIds = getBuyerIdsFromOffers();

    if (!activeBuyerItemFilter || !buyerIds.includes(Number(activeBuyerItemFilter))) {
        activeBuyerItemFilter = buyerIds.length > 0 ? String(buyerIds[0]) : '';
    }

    const selectedBuyerId = Number(activeBuyerItemFilter);
    const filteredBuyers = buyers.filter((buyer) => Number(buyer.buyer) === selectedBuyerId);

    const panel = document.createElement('section');
    panel.className = 'admin-trade-list buyer-admin-item-list';
    panel.innerHTML = `
        <div class="buyer-items-header">
            <h2>Buyer Items</h2>
            <label>Buyer ID<select class="buyer-items-filter"></select></label>
        </div>
    `;

    const select = panel.querySelector('.buyer-items-filter');

    if (buyerIds.length === 0) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'No buyer IDs';
        select.append(option);
        select.disabled = true;
    } else {
        buyerIds.forEach((buyerId) => {
            const option = document.createElement('option');
            option.value = String(buyerId);
            option.textContent = `Buyer ${buyerId}`;
            select.append(option);
        });
        select.value = activeBuyerItemFilter;
    }

    select.addEventListener('change', () => {
        activeBuyerItemFilter = select.value;
        renderBuyerAdmin();
    });

    const list = document.createElement('div');
    list.className = 'buyer-items-list';

    if (filteredBuyers.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'buyer-empty';
        empty.textContent = buyerIds.length === 0 ? 'No buyer offers have been added yet.' : 'No items for this Buyer ID.';
        list.append(empty);
    } else {
        filteredBuyers.forEach((buyer) => {
            const item = document.createElement('article');
            item.className = 'admin-trade buyer-item-row';
            item.innerHTML = `
                <div>
                    <h3></h3>
                    <p></p>
                </div>
                <span class="buyer-item-status"></span>
            `;

            const itemLabel = buyer.item?.label || buyer.item?.name || buyer.label;
            item.querySelector('h3').textContent = itemLabel;
            item.querySelector('p').textContent = `Offer #${buyer.index} - ${buyer.item?.count || 1}x ${buyer.item?.name || itemLabel} for $${buyer.price}`;
            item.querySelector('.buyer-item-status').textContent = buyer.enabled ? 'Enabled' : 'Disabled';
            item.querySelector('.buyer-item-status').classList.toggle('is-disabled', !buyer.enabled);
            list.append(item);
        });
    }

    panel.append(list);
    return panel;
}

function createBuyerAdminPedRow(ped, index) {
    const row = document.createElement('article');
    row.className = 'admin-ped buyer-admin-ped';
    row.innerHTML = `
        <div>
            <h3></h3>
            <p></p>
        </div>
        <button type="button" class="mini-button teleport-button">Teleport</button>
    `;

    const titleText = ped.menuTitle || ped.targetLabel || `Buyer ${ped.buyer || index}`;
    const coords = ped.coords || {};

    row.querySelector('h3').textContent = `[${index}] ${titleText}`;
    row.querySelector('p').textContent = `Buyer ${ped.buyer || 'all'} - ${ped.model || 'ped'} - ${Number(coords.x || 0).toFixed(2)}, ${Number(coords.y || 0).toFixed(2)}, ${Number(coords.z || 0).toFixed(2)}`;
    row.querySelector('.teleport-button').addEventListener('click', () => {
        postNui('buyerAdminTeleportPed', { index: ped.configIndex || index });
    });

    return row;
}

function getPedGroup(ped) {
    if (!ped) {
        return 1;
    }

    if (ped.type === 'decoration' || ped.type === 'export') {
        return '-';
    }

    return ped.type === 'buyer' ? ped.buyer || 1 : (ped.type === 'vehicle_spawner' ? ped.vehicle_spawner : ped.trader || 1);
}

function createPedAdminForm(ped = null) {
    const form = document.createElement('form');
    form.className = 'admin-form ped-admin-form';
    form.dataset.mode = ped ? 'edit' : 'add';

    const coords = ped?.coords || {};
    const spawnCoords = ped?.spawnCoords || coords || {};
    const pedType = ped?.type || (ped?.buyer ? 'buyer' : 'trader');
    const blipSprite = Number(ped?.blipSprite || 280);
    const selectedBlip = fivemBlipSprites.some((blip) => blip.id === blipSprite) ? blipSprite : 280;

    form.innerHTML = `
        <h2>${ped ? `Edit Ped #${ped.index}` : 'Add Ped'}</h2>
        <div class="admin-grid ped-admin-grid">
            <label>Type<select name="type" required><option value="trader">Trader</option><option value="buyer">Buyer</option><option value="decoration">Decoration (No Target)</option><option value="export">Export (Custom Action)</option><option value="vehicle_spawner">Vehicle Spawner</option></select></label>
            <label class="group-id-label">Group ID<input name="groupId" type="number" min="1" step="1" value="${getPedGroup(ped) === '-' ? 1 : getPedGroup(ped)}" required></label>
            <label>Model<input name="model" type="text" placeholder="s_m_m_dockwork_01" value="${ped?.model || ''}" required></label>
            <label>X<input name="x" type="number" step="0.0001" value="${coords.x ?? ''}" required></label>
            <label>Y<input name="y" type="number" step="0.0001" value="${coords.y ?? ''}" required></label>
            <label>Z<input name="z" type="number" step="0.0001" value="${coords.z ?? ''}" required></label>
            <label>Heading<input name="w" type="number" step="0.0001" value="${coords.w ?? 0}" required></label>
            <label>Scenario<input name="scenario" type="text" placeholder="WORLD_HUMAN_CLIPBOARD" value="${ped?.scenario || ''}"></label>
            <label class="target-label-label">Target Label<input name="targetLabel" type="text" placeholder="Trader" value="${ped?.targetLabel || ''}" required></label>
            <label class="target-icon-label">Target Icon<input name="targetIcon" type="text" placeholder="fa-solid fa-hand-holding-dollar" value="${ped?.targetIcon || ''}"></label>
            <label class="menu-title-label admin-wide">Menu Title<input name="menuTitle" type="text" placeholder="Item Exchange" value="${ped?.menuTitle || ''}" required></label>
            <label class="vehicle-target-jobs-label admin-wide">Allowed Jobs<input name="targetJobs" type="text" placeholder="police, sheriff, ambulance" value="${ped?.targetJobs || ''}"></label>
            <label class="vehicle-target-job-types-label admin-wide">Allowed Job Types<input name="targetJobTypes" type="text" placeholder="leo, ems" value="${ped?.targetJobTypes || ''}"></label>
            <label class="vehicle-spawn-x-label">Vehicle Spawn X<input name="spawnX" type="number" step="0.0001" value="${spawnCoords.x ?? ''}"></label>
            <label class="vehicle-spawn-y-label">Vehicle Spawn Y<input name="spawnY" type="number" step="0.0001" value="${spawnCoords.y ?? ''}"></label>
            <label class="vehicle-spawn-z-label">Vehicle Spawn Z<input name="spawnZ" type="number" step="0.0001" value="${spawnCoords.z ?? ''}"></label>
            <label class="vehicle-spawn-w-label">Vehicle Spawn Heading<input name="spawnW" type="number" step="0.0001" value="${spawnCoords.w ?? coords.w ?? 0}"></label>
            <label class="export-resource-label">Export Resource<input name="exportResource" type="text" placeholder="my_resource" value="${ped?.exportResource || ''}"></label>
            <label class="export-name-label">Export Function<input name="exportName" type="text" placeholder="openMenu" value="${ped?.exportName || ''}"></label>
            <label class="export-side-label">Export Side<select name="exportSide"><option value="client">Client</option><option value="server">Server</option></select></label>
            <label class="checkbox-label show-ped-label"><input name="showPed" type="checkbox" ${ped?.showPed === false ? '' : 'checked'}> Show Ped Model</label>
            <label class="checkbox-label"><input name="blipEnabled" type="checkbox" ${ped?.blipEnabled ? 'checked' : ''}> Enable Blip</label>
            <label>FiveM Blip<select name="blipSprite">${fivemBlipSprites.map((blip) => `<option value="${blip.id}">${blip.id} - ${blip.label}</option>`).join('')}</select></label>
        </div>
    `;

    const typeSelect = form.querySelector('select[name="type"]');
    typeSelect.value = pedType;
    form.querySelector('select[name="blipSprite"]').value = String(selectedBlip);
    if (ped?.exportSide) {
        form.querySelector('select[name="exportSide"]').value = ped.exportSide;
    }

    function updateDecorationFields() {
        const currentType = typeSelect.value;
        const isDecoration = currentType === 'decoration';
        const isExport = currentType === 'export';
        const isVehicleSpawner = currentType === 'vehicle_spawner';
        const isTraderOrBuyer = !isDecoration && !isExport && !isVehicleSpawner;

        const groupLabel = form.querySelector('.group-id-label');
        const targetLabelLabel = form.querySelector('.target-label-label');
        const menuTitleLabel = form.querySelector('.menu-title-label');
        const targetIconLabel = form.querySelector('.target-icon-label');
        const exportResourceLabel = form.querySelector('.export-resource-label');
        const exportNameLabel = form.querySelector('.export-name-label');
        const exportSideLabel = form.querySelector('.export-side-label');
        const showPedLabel = form.querySelector('.show-ped-label');
        const vehicleTargetJobsLabel = form.querySelector('.vehicle-target-jobs-label');
        const vehicleTargetJobTypesLabel = form.querySelector('.vehicle-target-job-types-label');
        const vehicleSpawnXLabel = form.querySelector('.vehicle-spawn-x-label');
        const vehicleSpawnYLabel = form.querySelector('.vehicle-spawn-y-label');
        const vehicleSpawnZLabel = form.querySelector('.vehicle-spawn-z-label');
        const vehicleSpawnWLabel = form.querySelector('.vehicle-spawn-w-label');
        const useCurrentSpawnButton = form.querySelector('.set-vehicle-spawn-button');

        if (groupLabel) {
            const showGroup = isTraderOrBuyer || isVehicleSpawner;
            groupLabel.style.display = showGroup ? '' : 'none';
            groupLabel.querySelector('input').required = showGroup;
            // Update the label text to match the ped type
            const labelText = groupLabel.childNodes[0];
            if (labelText && labelText.nodeType === Node.TEXT_NODE) {
                labelText.textContent = isVehicleSpawner ? 'Spawner ID' : 'Group ID';
            }
        }
        if (targetLabelLabel) {
            const input = targetLabelLabel.querySelector('input');
            targetLabelLabel.style.display = isDecoration ? 'none' : '';
            input.required = !isDecoration;
            input.placeholder = isVehicleSpawner ? 'Vehicle Spawner' : isExport ? 'Run Action' : currentType === 'buyer' ? 'Buyer' : 'Trader';

            if (isVehicleSpawner && !input.value.trim()) {
                input.value = 'Vehicle Spawner';
            }
        }
        if (menuTitleLabel) {
            menuTitleLabel.style.display = (isTraderOrBuyer || isVehicleSpawner) ? '' : 'none';
            menuTitleLabel.querySelector('input').required = isTraderOrBuyer;
        }
        if (targetIconLabel) {
            const input = targetIconLabel.querySelector('input');
            targetIconLabel.style.display = isDecoration ? 'none' : '';
            input.placeholder = isVehicleSpawner ? 'fa-solid fa-car' : currentType === 'buyer' ? 'fa-solid fa-dollar-sign' : 'fa-solid fa-hand-holding-dollar';

            if (isVehicleSpawner && !input.value.trim()) {
                input.value = 'fa-solid fa-car';
            }
        }
        if (exportResourceLabel) {
            exportResourceLabel.style.display = isExport ? '' : 'none';
            exportResourceLabel.querySelector('input').required = isExport;
        }
        if (exportNameLabel) {
            exportNameLabel.style.display = isExport ? '' : 'none';
            exportNameLabel.querySelector('input').required = isExport;
        }
        if (exportSideLabel) {
            exportSideLabel.style.display = isExport ? '' : 'none';
        }
        if (showPedLabel) {
            showPedLabel.style.display = isTraderOrBuyer ? '' : 'none';
        }
        if (vehicleTargetJobsLabel) {
            vehicleTargetJobsLabel.style.display = isVehicleSpawner ? '' : 'none';
        }
        if (vehicleTargetJobTypesLabel) {
            vehicleTargetJobTypesLabel.style.display = isVehicleSpawner ? '' : 'none';
        }
        if (vehicleSpawnXLabel) {
            const input = vehicleSpawnXLabel.querySelector('input');
            vehicleSpawnXLabel.style.display = isVehicleSpawner ? '' : 'none';
            input.required = isVehicleSpawner;
        }
        if (vehicleSpawnYLabel) {
            const input = vehicleSpawnYLabel.querySelector('input');
            vehicleSpawnYLabel.style.display = isVehicleSpawner ? '' : 'none';
            input.required = isVehicleSpawner;
        }
        if (vehicleSpawnZLabel) {
            const input = vehicleSpawnZLabel.querySelector('input');
            vehicleSpawnZLabel.style.display = isVehicleSpawner ? '' : 'none';
            input.required = isVehicleSpawner;
        }
        if (vehicleSpawnWLabel) {
            const input = vehicleSpawnWLabel.querySelector('input');
            vehicleSpawnWLabel.style.display = isVehicleSpawner ? '' : 'none';
            input.required = false;
        }
        if (useCurrentSpawnButton) {
            useCurrentSpawnButton.style.display = isVehicleSpawner ? '' : 'none';
        }
    }

    typeSelect.addEventListener('change', updateDecorationFields);
    updateDecorationFields();

    const useCurrent = document.createElement('button');
    useCurrent.className = 'mini-button admin-cancel-edit';
    useCurrent.type = 'button';
    useCurrent.textContent = 'Use Current Position';
    useCurrent.addEventListener('click', async () => {
        const response = await postNui('pedAdminUseCurrentCoords');
        const current = await response.json();

        if (!current || !current.ok) {
            return;
        }

        form.elements.x.value = Number(current.x || 0).toFixed(4);
        form.elements.y.value = Number(current.y || 0).toFixed(4);
        form.elements.z.value = Number(current.z || 0).toFixed(4);
        form.elements.w.value = Number(current.w || 0).toFixed(4);
    });

    const useCurrentSpawn = document.createElement('button');
    useCurrentSpawn.className = 'mini-button admin-cancel-edit set-vehicle-spawn-button';
    useCurrentSpawn.type = 'button';
    useCurrentSpawn.textContent = 'Use Current Position For Vehicle Spawn';
    useCurrentSpawn.addEventListener('click', async () => {
        const response = await postNui('pedAdminUseCurrentCoords');
        const current = await response.json();

        if (!current || !current.ok) {
            return;
        }

        if (!form.elements.spawnX || !form.elements.spawnY || !form.elements.spawnZ || !form.elements.spawnW) {
            return;
        }

        form.elements.spawnX.value = Number(current.x || 0).toFixed(4);
        form.elements.spawnY.value = Number(current.y || 0).toFixed(4);
        form.elements.spawnZ.value = Number(current.z || 0).toFixed(4);
        form.elements.spawnW.value = Number(current.w || 0).toFixed(4);
    });

    const submit = document.createElement('button');
    submit.className = 'trade-button admin-submit';
    submit.type = 'submit';
    submit.textContent = ped ? 'Save Ped' : 'Add Ped';

    form.append(useCurrent, useCurrentSpawn, submit);
    updateDecorationFields();

    if (ped) {
        const cancel = document.createElement('button');
        cancel.className = 'mini-button admin-cancel-edit';
        cancel.type = 'button';
        cancel.textContent = 'Cancel Edit';
        cancel.addEventListener('click', () => {
            editingPed = null;
            renderPedAdmin();
        });
        form.append(cancel);
    }

    form.addEventListener('submit', (event) => {
        event.preventDefault();

        const formData = new FormData(form);
        const payload = {
            type: formData.get('type'),
            groupId: formData.get('groupId'),
            model: formData.get('model'),
            x: formData.get('x'),
            y: formData.get('y'),
            z: formData.get('z'),
            w: formData.get('w'),
            scenario: formData.get('scenario'),
            targetLabel: formData.get('targetLabel'),
            targetIcon: formData.get('targetIcon'),
            menuTitle: formData.get('menuTitle'),
            exportResource: formData.get('exportResource'),
            exportName: formData.get('exportName'),
            exportSide: formData.get('exportSide'),
            targetJobs: formData.get('targetJobs'),
            targetJobTypes: formData.get('targetJobTypes'),
            spawnX: formData.get('spawnX'),
            spawnY: formData.get('spawnY'),
            spawnZ: formData.get('spawnZ'),
            spawnW: formData.get('spawnW'),
            showPed: formData.has('showPed'),
            blipEnabled: formData.has('blipEnabled'),
            blipSprite: formData.get('blipSprite')
        };

        if (ped) {
            payload.index = ped.index;
            postNui('pedAdminUpdatePed', payload);
            return;
        }

        postNui('pedAdminAddPed', payload);
    });

    return form;
}

function createPedAdminRow(ped) {
    const row = document.createElement('article');
    row.className = 'admin-trade ped-admin-row';
    row.innerHTML = `
        <div>
            <h3></h3>
            <p></p>
        </div>
        <button type="button" class="mini-button teleport-button">Teleport</button>
        <button type="button" class="mini-button edit-button">Edit</button>
        <button type="button" class="mini-button toggle-button"></button>
        <button type="button" class="mini-button delete-button">Delete</button>
        <div class="delete-confirm" hidden>
            <span></span>
            <button type="button" class="mini-button confirm-delete-button">Confirm</button>
            <button type="button" class="mini-button cancel-delete-button">Cancel</button>
        </div>
    `;

    const coords = ped.coords || {};
    const titleText = (ped.type === 'decoration' || ped.type === 'vehicle_spawner')
        ? ped.menuTitle || ped.model || `${ped.type || 'Decoration'} ${ped.index}`
        : ped.menuTitle || ped.targetLabel || `${ped.type === 'buyer' ? 'Buyer' : 'Trader'} ${getPedGroup(ped)}`;

    row.querySelector('h3').textContent = `[${ped.index}] ${titleText}`;
    const accessText = ped.type === 'vehicle_spawner'
        ? ` - Jobs ${ped.targetJobs || 'any'} - Types ${ped.targetJobTypes || 'any'}`
        : '';
    row.querySelector('p').textContent = `${ped.enabled ? 'Enabled' : 'Disabled'} - ${ped.type || 'trader'}${(ped.type !== 'decoration' && ped.type !== 'export') ? ' ' + getPedGroup(ped) : ''} - ${ped.showPed === false ? 'Location target' : ped.model || 'ped'}${accessText} - Blip ${ped.blipEnabled ? ped.blipSprite || 280 : 'off'} - ${Number(coords.x || 0).toFixed(2)}, ${Number(coords.y || 0).toFixed(2)}, ${Number(coords.z || 0).toFixed(2)}`;

    row.querySelector('.teleport-button').addEventListener('click', () => {
        postNui('pedAdminTeleportPed', { index: ped.index });
    });

    row.querySelector('.edit-button').addEventListener('click', () => {
        editingPed = ped;
        renderPedAdmin();
    });

    const toggleButton = row.querySelector('.toggle-button');
    toggleButton.textContent = ped.enabled ? 'Disable' : 'Enable';
    toggleButton.addEventListener('click', () => {
        postNui('pedAdminTogglePed', { index: ped.index });
    });

    const deleteConfirm = row.querySelector('.delete-confirm');
    deleteConfirm.querySelector('span').textContent = `Delete ${titleText}?`;

    row.querySelector('.delete-button').addEventListener('click', () => {
        deleteConfirm.hidden = false;
    });

    row.querySelector('.cancel-delete-button').addEventListener('click', () => {
        deleteConfirm.hidden = true;
    });

    row.querySelector('.confirm-delete-button').addEventListener('click', () => {
        postNui('pedAdminDeletePed', { index: ped.index });
        deleteConfirm.hidden = true;
    });

    return row;
}

function renderAdmin() {
    clearBuyerHeaderSearch();
    body.classList.remove('is-buyer');
    body.classList.remove('is-buyer-admin');
    body.classList.remove('is-ped-admin');
    body.classList.remove('is-vehicle-admin');
    body.classList.remove('is-admin-hub');
    body.classList.add('is-admin');
    minimizeButton.style.display = 'none';
    eyebrow.textContent = '';
    tradeList.className = 'trade-list admin-layout';

    const adminShell = document.createElement('div');
    adminShell.className = 'admin-shell';

    const tabs = document.createElement('div');
    tabs.className = 'admin-tabs';

    const tradesTab = document.createElement('button');
    tradesTab.type = 'button';
    tradesTab.className = activeAdminTab === 'trades' ? 'admin-tab is-active' : 'admin-tab';
    tradesTab.textContent = 'Trades';
    tradesTab.addEventListener('click', () => {
        activeAdminTab = 'trades';
        renderAdmin();
    });

    const pedsTab = document.createElement('button');
    pedsTab.type = 'button';
    pedsTab.className = activeAdminTab === 'peds' ? 'admin-tab is-active' : 'admin-tab';
    pedsTab.textContent = 'Trader Peds';
    pedsTab.addEventListener('click', () => {
        activeAdminTab = 'peds';
        editingTrade = null;
        renderAdmin();
    });

    tabs.append(tradesTab, pedsTab);

    const tradePanel = document.createElement('section');
    tradePanel.className = 'admin-trade-list';
    tradePanel.innerHTML = '<h2>Database Trades</h2>';
    tradePanel.append(...trades.map(createAdminTradeRow));

    const pedPanel = document.createElement('section');
    pedPanel.className = 'admin-ped-list';
    pedPanel.innerHTML = '<h2>Trader Peds</h2>';
    pedPanel.append(...adminPeds.map((ped, index) => createAdminPedRow(ped, index + 1)));

    adminShell.append(tabs);

    if (activeAdminTab === 'peds') {
        adminShell.append(pedPanel);
    } else {
        adminShell.append(createAdminForm(editingTrade), tradePanel);
    }

    tradeList.replaceChildren(adminShell);
}

function renderBuyerAdmin() {
    clearBuyerHeaderSearch();
    body.classList.remove('is-admin');
    body.classList.remove('is-buyer');
    body.classList.remove('is-ped-admin');
    body.classList.remove('is-vehicle-admin');
    body.classList.remove('is-admin-hub');
    body.classList.add('is-buyer-admin');
    minimizeButton.style.display = 'none';
    eyebrow.textContent = '';
    tradeList.className = 'trade-list admin-layout buyer-admin-layout';

    const adminShell = document.createElement('div');
    adminShell.className = 'admin-shell buyer-admin-shell';

    const tabs = document.createElement('div');
    tabs.className = 'admin-tabs';

    const offersTab = document.createElement('button');
    offersTab.type = 'button';
    offersTab.className = activeBuyerAdminTab === 'offers' ? 'admin-tab is-active' : 'admin-tab';
    offersTab.textContent = 'Buyer Offers';
    offersTab.addEventListener('click', () => {
        activeBuyerAdminTab = 'offers';
        renderBuyerAdmin();
    });

    const pedsTab = document.createElement('button');
    pedsTab.type = 'button';
    pedsTab.className = activeBuyerAdminTab === 'peds' ? 'admin-tab is-active' : 'admin-tab';
    pedsTab.textContent = 'Buyer Peds';
    pedsTab.addEventListener('click', () => {
        activeBuyerAdminTab = 'peds';
        editingBuyer = null;
        renderBuyerAdmin();
    });

    const itemsTab = document.createElement('button');
    itemsTab.type = 'button';
    itemsTab.className = activeBuyerAdminTab === 'items' ? 'admin-tab is-active' : 'admin-tab';
    itemsTab.textContent = 'Buyer Items';
    itemsTab.addEventListener('click', () => {
        activeBuyerAdminTab = 'items';
        editingBuyer = null;
        renderBuyerAdmin();
    });

    tabs.append(offersTab, itemsTab, pedsTab);

    const offerPanel = document.createElement('section');
    offerPanel.className = 'admin-trade-list buyer-admin-offer-list';
    offerPanel.innerHTML = '<h2>Buyer Offers</h2>';
    offerPanel.append(...buyers.map(createBuyerAdminRow));

    const pedPanel = document.createElement('section');
    pedPanel.className = 'admin-ped-list buyer-admin-ped-list';
    pedPanel.innerHTML = '<h2>Buyer Peds</h2>';
    pedPanel.append(...adminPeds.map((ped, index) => createBuyerAdminPedRow(ped, index + 1)));

    adminShell.append(tabs);

    if (activeBuyerAdminTab === 'peds') {
        adminShell.append(pedPanel);
    } else if (activeBuyerAdminTab === 'items') {
        adminShell.append(createBuyerItemsPanel());
    } else {
        adminShell.append(createBuyerAdminForm(editingBuyer), offerPanel);
    }

    tradeList.replaceChildren(adminShell);
}

function renderPedAdmin() {
    clearBuyerHeaderSearch();
    body.classList.remove('is-admin');
    body.classList.remove('is-buyer');
    body.classList.remove('is-buyer-admin');
    body.classList.remove('is-ped-admin');
    body.classList.remove('is-admin-hub');
    body.classList.add('is-ped-admin');
    minimizeButton.style.display = '';
    eyebrow.textContent = '';
    tradeList.className = 'trade-list admin-layout ped-admin-layout';

    const adminShell = document.createElement('div');
    adminShell.className = 'admin-shell ped-admin-shell';

    const pedPanel = document.createElement('section');
    pedPanel.className = 'admin-trade-list ped-admin-list';
    pedPanel.innerHTML = '<h2>Database Peds</h2>';
    pedPanel.append(...pedAdminPeds.map(createPedAdminRow));

    adminShell.append(createPedAdminForm(editingPed), pedPanel);
    tradeList.replaceChildren(adminShell);
    restorePedAdminFormState();
}

function saveVehicleAdminFormState() {
    const panel = document.querySelector('.panel');
    if (!panel) return;

    const cache = { tab: activeVehicleAdminTab, editingCert: editingCert, editingVehicle: editingVehicle, certs: {}, vehicles: {} };

    const certSpawnerId = panel.querySelector('.cert-spawner-id-input');
    const certType = panel.querySelector('.cert-type-input');
    const certLabel = panel.querySelector('.cert-label-input');
    const certMaxSpawned = panel.querySelector('.cert-max-spawned-input');
    if (certSpawnerId || certType || certLabel || certMaxSpawned) {
        cache.certs = {
            spawnerId: certSpawnerId?.value || '',
            type: certType?.value || '',
            label: certLabel?.value || '',
            maxSpawned: certMaxSpawned?.value || ''
        };
    }

    const certSelect = panel.querySelector('.vehicle-cert-select');
    const vehicleSpawnerId = panel.querySelector('.vehicle-spawner-id-input');
    const vehicleModel = panel.querySelector('.vehicle-model-input');
    const vehicleLabel = panel.querySelector('.vehicle-label-input');
    const vehicleLivery = panel.querySelector('.vehicle-livery-input');
    const vehicleExtras = panel.querySelector('.vehicle-extras-input');
    const vehicleEngine = panel.querySelector('.vehicle-engine-input');
    const vehicleAllowedJobs = panel.querySelector('.vehicle-allowed-jobs-input');
    if (certSelect || vehicleModel || vehicleLabel) {
        cache.vehicles = {
            certSelect: certSelect?.value || '',
            spawnerId: vehicleSpawnerId?.value || '',
            model: vehicleModel?.value || '',
            label: vehicleLabel?.value || '',
            livery: vehicleLivery?.value || '',
            extras: vehicleExtras?.value || '',
            engine: vehicleEngine?.value || '',
            allowedJobs: vehicleAllowedJobs?.value || ''
        };
    }

    vehicleAdminFormCache = cache;
}

function restoreVehicleAdminFormState() {
    if (!vehicleAdminFormCache) return;

    const panel = document.querySelector('.panel');
    if (!panel) return;

    const cache = vehicleAdminFormCache;

    if (cache.editingCert !== undefined) editingCert = cache.editingCert;
    if (cache.editingVehicle !== undefined) editingVehicle = cache.editingVehicle;

    if (cache.certs) {
        const certSpawnerId = panel.querySelector('.cert-spawner-id-input');
        const certType = panel.querySelector('.cert-type-input');
        const certLabel = panel.querySelector('.cert-label-input');
        const certMaxSpawned = panel.querySelector('.cert-max-spawned-input');
        if (certSpawnerId && cache.certs.spawnerId !== undefined) certSpawnerId.value = cache.certs.spawnerId;
        if (certType && cache.certs.type !== undefined) certType.value = cache.certs.type;
        if (certLabel && cache.certs.label !== undefined) certLabel.value = cache.certs.label;
        if (certMaxSpawned && cache.certs.maxSpawned !== undefined) certMaxSpawned.value = cache.certs.maxSpawned;
    }

    if (cache.vehicles) {
        const certSelect = panel.querySelector('.vehicle-cert-select');
        const vehicleSpawnerId = panel.querySelector('.vehicle-spawner-id-input');
        const vehicleModel = panel.querySelector('.vehicle-model-input');
        const vehicleLabel = panel.querySelector('.vehicle-label-input');
        const vehicleLivery = panel.querySelector('.vehicle-livery-input');
        const vehicleExtras = panel.querySelector('.vehicle-extras-input');
        const vehicleEngine = panel.querySelector('.vehicle-engine-input');
        const vehicleAllowedJobs = panel.querySelector('.vehicle-allowed-jobs-input');
        if (certSelect && cache.vehicles.certSelect !== undefined) certSelect.value = cache.vehicles.certSelect;
        if (vehicleSpawnerId && cache.vehicles.spawnerId !== undefined) vehicleSpawnerId.value = cache.vehicles.spawnerId;
        if (vehicleModel && cache.vehicles.model !== undefined) vehicleModel.value = cache.vehicles.model;
        if (vehicleLabel && cache.vehicles.label !== undefined) vehicleLabel.value = cache.vehicles.label;
        if (vehicleLivery && cache.vehicles.livery !== undefined) vehicleLivery.value = cache.vehicles.livery;
        if (vehicleExtras && cache.vehicles.extras !== undefined) vehicleExtras.value = cache.vehicles.extras;
        if (vehicleEngine && cache.vehicles.engine !== undefined) vehicleEngine.value = cache.vehicles.engine;
        if (vehicleAllowedJobs && cache.vehicles.allowedJobs !== undefined) vehicleAllowedJobs.value = cache.vehicles.allowedJobs;
    }
}

function savePedAdminFormState() {
    const panel = document.querySelector('.panel');
    if (!panel) return;

    const form = panel.querySelector('.ped-admin-form');
    if (!form) return;

    const cache = { editingIndex: editingPed ? editingPed.index : null, fields: {} };
    const formData = new FormData(form);

    for (const [key, value] of formData.entries()) {
        cache.fields[key] = value;
    }

    cache.fields.showPed = form.querySelector('input[name="showPed"]')?.checked || false;
    cache.fields.blipEnabled = form.querySelector('input[name="blipEnabled"]')?.checked || false;

    pedAdminFormCache = cache;
}

function restorePedAdminFormState() {
    if (!pedAdminFormCache) return;

    const panel = document.querySelector('.panel');
    if (!panel) return;

    const form = panel.querySelector('.ped-admin-form');
    if (!form) return;

    const cache = pedAdminFormCache;

    for (const [key, value] of Object.entries(cache.fields)) {
        const input = form.querySelector(`[name="${key}"]`);
        if (!input) continue;

        if (input.type === 'checkbox') {
            input.checked = !!value;
        } else {
            input.value = value;
        }
    }

    const typeSelect = form.querySelector('select[name="type"]');
    if (typeSelect) {
        typeSelect.dispatchEvent(new Event('change'));
    }
}

function renderVehicleAdmin() {
    clearBuyerHeaderSearch();
    body.classList.remove('is-admin');
    body.classList.remove('is-buyer');
    body.classList.remove('is-buyer-admin');
    body.classList.remove('is-ped-admin');
    body.classList.remove('is-admin-hub');
    body.classList.add('is-vehicle-admin');
    eyebrow.textContent = '';
    tradeList.className = 'trade-list admin-layout vehicle-admin-layout';

    const adminShell = document.createElement('div');
    adminShell.className = 'admin-shell vehicle-admin-shell';

    const tabs = document.createElement('div');
    tabs.className = 'admin-tabs vehicle-admin-tabs';

    const licensesTab = document.createElement('button');
    licensesTab.type = 'button';
    licensesTab.className = activeVehicleAdminTab === 'licenses' ? 'admin-tab is-active' : 'admin-tab';
    licensesTab.textContent = 'Licenses';
    licensesTab.addEventListener('click', () => {
        activeVehicleAdminTab = 'licenses';
        editingCert = null;
        editingVehicle = null;
        renderVehicleAdmin();
    });

    const vehiclesTab = document.createElement('button');
    vehiclesTab.type = 'button';
    vehiclesTab.className = activeVehicleAdminTab === 'vehicles' ? 'admin-tab is-active' : 'admin-tab';
    vehiclesTab.textContent = 'Vehicles';
    vehiclesTab.addEventListener('click', () => {
        activeVehicleAdminTab = 'vehicles';
        editingCert = null;
        editingVehicle = null;
        renderVehicleAdmin();
    });

    tabs.append(licensesTab, vehiclesTab);

    // Certification Management Section
    const certSection = document.createElement('section');
    certSection.className = 'vehicle-admin-section';
    certSection.innerHTML = '<h2>Licenses</h2>';

    const certList = document.createElement('div');
    certList.className = 'vehicle-admin-list';

    // Add/Edit Certification Form
    const certForm = document.createElement('div');
    certForm.className = 'vehicle-admin-form';
    const isEditingCert = editingCert && editingCert.id;

    certForm.innerHTML = `
        <h3>${isEditingCert ? 'Edit License' : 'Add License'}</h3>
        <input type="number" class="cert-spawner-id-input" placeholder="Vehicle Spawner ID (blank = all peds)" min="1" value="${isEditingCert ? (editingCert.vehicle_spawner_id || '') : ''}" />
        <input type="text" class="cert-type-input" placeholder="Cert Type (e.g., heat, moto, k9, air)" value="${isEditingCert ? editingCert.cert_type : ''}" />
        <input type="text" class="cert-label-input" placeholder="Label (e.g., Heat License)" value="${isEditingCert ? editingCert.label : ''}" />
        <input type="number" class="cert-max-spawned-input" placeholder="Max Spawned" min="1" value="${isEditingCert ? editingCert.max_spawned : ''}" />
        <button type="button" class="cert-add-button">${isEditingCert ? 'Save Changes' : 'Add License'}</button>
        ${isEditingCert ? '<button type="button" class="cert-cancel-button">Cancel</button>' : ''}
    `;

    const certTypeInput = certForm.querySelector('.cert-type-input');
    const certSpawnerIdInput = certForm.querySelector('.cert-spawner-id-input');
    const certLabelInput = certForm.querySelector('.cert-label-input');
    const certMaxSpawnedInput = certForm.querySelector('.cert-max-spawned-input');
    const certAddButton = certForm.querySelector('.cert-add-button');

    certAddButton.addEventListener('click', () => {
        const certType = certTypeInput.value.trim();
        const label = certLabelInput.value.trim();
        const maxSpawned = parseInt(certMaxSpawnedInput.value);
        const spawnerIdValue = certSpawnerIdInput.value.trim();
        const spawnerId = spawnerIdValue ? parseInt(spawnerIdValue, 10) : null;

        if (!certType || !label || isNaN(maxSpawned) || maxSpawned < 1 || (spawnerIdValue && (isNaN(spawnerId) || spawnerId < 1))) {
            alert('Please fill all fields with valid values');
            return;
        }

        if (isEditingCert) {
            postNui('vehicleAdminUpdateCert', { id: editingCert.id, cert_type: certType, label, max_spawned: maxSpawned, vehicle_spawner_id: spawnerId });
            editingCert = null;
        } else {
            postNui('vehicleAdminAddCert', { cert_type: certType, label, max_spawned: maxSpawned, vehicle_spawner_id: spawnerId });
        }
        certSpawnerIdInput.value = '';
        certTypeInput.value = '';
        certLabelInput.value = '';
        certMaxSpawnedInput.value = '';
    });

    const certCancelButton = certForm.querySelector('.cert-cancel-button');
    if (certCancelButton) {
        certCancelButton.addEventListener('click', () => {
            editingCert = null;
            renderVehicleAdmin();
        });
    }

    // Existing Certifications List
    vehicleSpawnerCerts.forEach((cert) => {
        const certRow = document.createElement('div');
        certRow.className = 'vehicle-admin-row';
        certRow.innerHTML = `
            <div class="vehicle-admin-row-info">
                <span class="cert-type">${cert.cert_type}</span>
                <span class="cert-label">${cert.label}</span>
                <span class="cert-spawner-id">Spawner: ${cert.vehicle_spawner_id || 'All'}</span>
                <span class="cert-max-spawned">Max: ${cert.max_spawned}</span>
                <span class="cert-status">${cert.enabled ? 'Enabled' : 'Disabled'}</span>
            </div>
            <div class="vehicle-admin-row-actions">
                <button type="button" class="cert-edit-button">Edit</button>
                <button type="button" class="cert-toggle-button">${cert.enabled ? 'Disable' : 'Enable'}</button>
                <button type="button" class="cert-delete-button">Delete</button>
            </div>
            <div class="delete-confirm" hidden>
                <span>Delete license "${cert.cert_type}"?</span>
                <button type="button" class="mini-button confirm-delete-button">Confirm</button>
                <button type="button" class="mini-button cancel-delete-button">Cancel</button>
            </div>
        `;

        certRow.querySelector('.cert-edit-button').addEventListener('click', () => {
            editingCert = cert;
            renderVehicleAdmin();
        });

        certRow.querySelector('.cert-toggle-button').addEventListener('click', () => {
            postNui('vehicleAdminToggleCert', { id: cert.id });
        });

        const deleteConfirm = certRow.querySelector('.delete-confirm');
        certRow.querySelector('.cert-delete-button').addEventListener('click', () => {
            deleteConfirm.hidden = false;
        });
        deleteConfirm.querySelector('.cancel-delete-button').addEventListener('click', () => {
            deleteConfirm.hidden = true;
        });
        deleteConfirm.querySelector('.confirm-delete-button').addEventListener('click', () => {
            postNui('vehicleAdminDeleteCert', { id: cert.id });
            deleteConfirm.hidden = true;
        });

        certList.append(certRow);
    });

    certSection.append(certForm, certList);

    // Vehicle Management Section
    const vehicleSection = document.createElement('section');
    vehicleSection.className = 'vehicle-admin-section';
    vehicleSection.innerHTML = '<h2>Vehicles</h2>';

    const vehicleList = document.createElement('div');
    vehicleList.className = 'vehicle-admin-list';

    // Add/Edit Vehicle Form
    const isEditingVehicle = editingVehicle && editingVehicle.id;
    const vehicleForm = document.createElement('div');
    vehicleForm.className = 'vehicle-admin-form';

    const certSelect = document.createElement('select');
    certSelect.className = 'vehicle-cert-select';
    certSelect.innerHTML = '<option value="">-- Select Certification --</option>';
    vehicleSpawnerCerts.forEach((cert) => {
        const option = document.createElement('option');
        option.value = cert.cert_type;
        option.dataset.spawnerId = cert.vehicle_spawner_id || '';
        option.textContent = `${cert.label} (${cert.cert_type}) - Spawner: ${cert.vehicle_spawner_id || 'All'}`;
        certSelect.append(option);
    });

    vehicleForm.innerHTML = `
        <h3>${isEditingVehicle ? 'Edit Vehicle' : 'Add Vehicle'}</h3>
    `;
    vehicleForm.append(certSelect);
    vehicleForm.insertAdjacentHTML('beforeend', `
        <input type="number" class="vehicle-spawner-id-input" placeholder="Vehicle Spawner ID (blank = all peds)" min="1" value="${isEditingVehicle ? (editingVehicle.vehicle_spawner_id || '') : ''}" />
        <input type="text" class="vehicle-model-input" placeholder="Model Name (e.g., granger)" value="${isEditingVehicle ? editingVehicle.model : ''}" />
        <input type="text" class="vehicle-label-input" placeholder="Label (e.g., Granger)" value="${isEditingVehicle ? editingVehicle.label : ''}" />
        <input type="number" class="vehicle-livery-input" placeholder="Livery Number (optional)" min="0" step="1" value="${isEditingVehicle && editingVehicle.livery != null ? editingVehicle.livery : ''}" />
        <input type="text" class="vehicle-extras-input" placeholder="Extras (optional, e.g. 1,2,3)" value="${isEditingVehicle ? (editingVehicle.extras || '') : ''}" />
        <input type="number" class="vehicle-engine-input" placeholder="Engine Mod (0-4, optional)" min="0" max="4" step="1" value="${isEditingVehicle && editingVehicle.mod_engine != null ? editingVehicle.mod_engine : ''}" />
        <input type="text" class="vehicle-allowed-jobs-input" placeholder="Allowed Jobs/Types (optional, e.g. leo,police,ems)" value="${isEditingVehicle ? (editingVehicle.allowed_jobs || '') : ''}" />
        <button type="button" class="vehicle-add-button">${isEditingVehicle ? 'Save Changes' : 'Add Vehicle'}</button>
        ${isEditingVehicle ? '<button type="button" class="vehicle-cancel-button">Cancel</button>' : ''}
    `);

    const vehicleSpawnerIdInput = vehicleForm.querySelector('.vehicle-spawner-id-input');
    const vehicleModelInput = vehicleForm.querySelector('.vehicle-model-input');
    const vehicleLabelInput = vehicleForm.querySelector('.vehicle-label-input');
    const vehicleLiveryInput = vehicleForm.querySelector('.vehicle-livery-input');
    const vehicleExtrasInput = vehicleForm.querySelector('.vehicle-extras-input');
    const vehicleEngineInput = vehicleForm.querySelector('.vehicle-engine-input');
    const vehicleAllowedJobsInput = vehicleForm.querySelector('.vehicle-allowed-jobs-input');
    const vehicleAddButton = vehicleForm.querySelector('.vehicle-add-button');

    if (isEditingVehicle) {
        certSelect.value = editingVehicle.cert_type || '';
    }

    certSelect.addEventListener('change', () => {
        const selectedOption = certSelect.options[certSelect.selectedIndex];
        vehicleSpawnerIdInput.value = selectedOption?.dataset.spawnerId || '';
    });

    vehicleAddButton.addEventListener('click', () => {
        const certType = certSelect.value.trim();
        const spawnerIdValue = vehicleSpawnerIdInput.value.trim();
        const spawnerId = spawnerIdValue ? parseInt(spawnerIdValue, 10) : null;
        const model = vehicleModelInput.value.trim().toLowerCase();
        const label = vehicleLabelInput.value.trim();
        const liveryValue = vehicleLiveryInput.value.trim();
        const livery = liveryValue ? parseInt(liveryValue, 10) : null;
        const extras = vehicleExtrasInput.value.trim();
        const engineValue = vehicleEngineInput.value.trim();
        const engineMod = engineValue ? parseInt(engineValue, 10) : null;
        const allowedJobs = vehicleAllowedJobsInput.value.trim();

        if (!certType || !model || !label
            || (spawnerIdValue && (isNaN(spawnerId) || spawnerId < 1))
            || (liveryValue && (isNaN(livery) || livery < 0))
            || (engineValue && (isNaN(engineMod) || engineMod < 0 || engineMod > 4))) {
            alert('Please fill all fields');
            return;
        }

        const payload = {
            cert_type: certType,
            model,
            label,
            vehicle_spawner_id: spawnerId,
            livery,
            extras,
            mod_engine: engineMod,
            allowed_jobs: allowedJobs
        };

        if (isEditingVehicle) {
            payload.id = editingVehicle.id;
            postNui('vehicleAdminUpdateVehicle', payload);
            editingVehicle = null;
        } else {
            postNui('vehicleAdminAddVehicle', payload);
        }
        vehicleSpawnerIdInput.value = '';
        vehicleModelInput.value = '';
        vehicleLabelInput.value = '';
        vehicleLiveryInput.value = '';
        vehicleExtrasInput.value = '';
        vehicleEngineInput.value = '';
        vehicleAllowedJobsInput.value = '';
        certSelect.value = '';
    });

    const vehicleCancelButton = vehicleForm.querySelector('.vehicle-cancel-button');
    if (vehicleCancelButton) {
        vehicleCancelButton.addEventListener('click', () => {
            editingVehicle = null;
            renderVehicleAdmin();
        });
    }

    // Existing Vehicles List (grouped by certification)
    vehicleSpawnerCerts.forEach((cert) => {
        const certVehicles = vehicleSpawnerVehicles.filter((v) => v.cert_type === cert.cert_type);
        if (certVehicles.length === 0) return;

        const certHeader = document.createElement('div');
        certHeader.className = 'vehicle-cert-header';
        certHeader.innerHTML = `<h4>${cert.label}</h4>`;
        vehicleList.append(certHeader);

        certVehicles.forEach((vehicle) => {
            const vehicleRow = document.createElement('div');
            vehicleRow.className = 'vehicle-admin-row';
            vehicleRow.innerHTML = `
                <div class="vehicle-admin-row-info">
                    <span class="vehicle-model">${vehicle.model}</span>
                    <span class="vehicle-label">${vehicle.label}</span>
                    <span class="vehicle-spawner-id">Spawner: ${vehicle.vehicle_spawner_id || 'All'}</span>
                    <span class="vehicle-livery">Livery: ${vehicle.livery ?? 'Default'}</span>
                    <span class="vehicle-extras">Extras: ${vehicle.extras || 'Default'}</span>
                    <span class="vehicle-engine">Engine: ${vehicle.mod_engine ?? 'Default'}</span>
                    <span class="vehicle-allowed-jobs">Jobs: ${vehicle.allowed_jobs || 'All'}</span>
                    <span class="vehicle-status">${vehicle.enabled ? 'Enabled' : 'Disabled'}</span>
                </div>
                <div class="vehicle-admin-row-actions">
                    <button type="button" class="vehicle-edit-button">Edit</button>
                    <button type="button" class="vehicle-toggle-button">${vehicle.enabled ? 'Disable' : 'Enable'}</button>
                    <button type="button" class="vehicle-delete-button">Delete</button>
                </div>
                <div class="delete-confirm" hidden>
                    <span>Delete vehicle "${vehicle.label}"?</span>
                    <button type="button" class="mini-button confirm-delete-button">Confirm</button>
                    <button type="button" class="mini-button cancel-delete-button">Cancel</button>
                </div>
            `;

            vehicleRow.querySelector('.vehicle-edit-button').addEventListener('click', () => {
                editingVehicle = vehicle;
                activeVehicleAdminTab = 'vehicles';
                renderVehicleAdmin();
            });

            vehicleRow.querySelector('.vehicle-toggle-button').addEventListener('click', () => {
                postNui('vehicleAdminToggleVehicle', { id: vehicle.id });
            });

            const deleteConfirm = vehicleRow.querySelector('.delete-confirm');
            vehicleRow.querySelector('.vehicle-delete-button').addEventListener('click', () => {
                deleteConfirm.hidden = false;
            });
            deleteConfirm.querySelector('.cancel-delete-button').addEventListener('click', () => {
                deleteConfirm.hidden = true;
            });
            deleteConfirm.querySelector('.confirm-delete-button').addEventListener('click', () => {
                postNui('vehicleAdminDeleteVehicle', { id: vehicle.id });
                deleteConfirm.hidden = true;
            });

            vehicleList.append(vehicleRow);
        });
    });

    vehicleSection.append(vehicleForm, vehicleList);

    adminShell.append(tabs);

    if (activeVehicleAdminTab === 'vehicles') {
        adminShell.append(vehicleSection);
    } else {
        adminShell.append(certSection);
    }

    tradeList.replaceChildren(adminShell);
    minimizeButton.style.display = '';
    restoreVehicleAdminFormState();
}

/* ═══════════════════════════════════════════
   Admin Hub
   ═══════════════════════════════════════════ */

const adminHubSidebar = document.getElementById('admin-hub-sidebar');
const adminHubContentHeader = document.getElementById('admin-hub-content-header');
const adminHubCommandGrid = document.getElementById('admin-hub-command-grid');
const adminHubModal = document.getElementById('admin-hub-modal');
const adminHubModalTitle = document.getElementById('admin-hub-modal-title');
const adminHubModalBody = document.getElementById('admin-hub-modal-body');
const adminHubModalClose = document.getElementById('admin-hub-modal-close');
const adminHubModalCancel = document.getElementById('admin-hub-modal-cancel');
const adminHubModalSave = document.getElementById('admin-hub-modal-save');
const adminHubConfirmModal = document.getElementById('admin-hub-confirm-modal');
const adminHubConfirmTitle = document.getElementById('admin-hub-confirm-title');
const adminHubConfirmText = document.getElementById('admin-hub-confirm-text');
const adminHubConfirmClose = document.getElementById('admin-hub-confirm-close');
const adminHubConfirmCancel = document.getElementById('admin-hub-confirm-cancel');
const adminHubConfirmOk = document.getElementById('admin-hub-confirm-ok');
const adminHubCloseButton = document.getElementById('admin-hub-close-button');

const adminHubIconOptions = ['⚙️', '🔄', '💰', '👤', '🚗', '📝', '⚠️', '🔧', '🗑️', '📡', '💾', '🔐', '📋', '👥', '🗄️', '🔌'];
const adminHubPermissionOptions = [
    { value: 'admin', label: 'Admin Only' },
    { value: 'group.admin', label: 'Group: Admin' },
    { value: 'group.mod', label: 'Group: Mod' },
    { value: 'group.support', label: 'Group: Support' },
    { value: 'command.add_ace', label: 'Command: Add ACE' },
    { value: 'command.remove_ace', label: 'Command: Remove ACE' },
    { value: 'command.resmon', label: 'Command: Resmon' },
    { value: 'command.clothingadmin', label: 'Command: Clothing Admin' },
    { value: 'command.exchangeadmin', label: 'Command: Exchange Admin' },
    { value: 'command.buyeradmin', label: 'Command: Buyer Admin' },
    { value: 'command.pedadmin', label: 'Command: Ped Admin' },
    { value: 'trades', label: 'Trading Permission' },
    { value: 'buyers', label: 'Buyer Permission' },
    { value: 'peds', label: 'Ped Permission' },
    { value: 'vehicles', label: 'Vehicle Permission' },
    { value: 'jg.admin', label: 'Group: JG Admin' }
];

let adminHubEditedCommandId = null;
let adminHubCommandParameters = {};;

let adminHubModalMode = null;
let adminHubEditingId = null;

function renderAdminHub() {
    adminHubSidebar.innerHTML = '';

    const hasBuiltIn = adminHubBuiltIn.length > 0;

    const builtInLabel = document.createElement('div');
    builtInLabel.className = 'admin-hub-sidebar-label';
    builtInLabel.textContent = 'Built-in';
    adminHubSidebar.append(builtInLabel);

    if (hasBuiltIn) {
        const item = document.createElement('div');
        item.className = 'admin-hub-sidebar-item' + (adminHubActiveCategory === '_builtin_exchange' ? ' active' : '');
        item.innerHTML = '<span class="icon">🔄</span> Exchange';
        item.addEventListener('click', () => {
            adminHubActiveCategory = '_builtin_exchange';
            renderAdminHub();
        });
        adminHubSidebar.append(item);
    }

    if (adminHubCategories.length > 0) {
        const divider = document.createElement('div');
        divider.className = 'admin-hub-sidebar-divider';
        const customLabel = document.createElement('div');
        customLabel.className = 'admin-hub-sidebar-label';
        customLabel.textContent = 'Custom';
        adminHubSidebar.append(divider, customLabel);

        adminHubCategories.forEach((cat) => {
            const item = document.createElement('div');
            item.className = 'admin-hub-sidebar-item' + (adminHubActiveCategory === 'cat_' + cat.id ? ' active' : '');
            item.innerHTML = `<span class="icon">${cat.icon || '⚙️'}</span> ${cat.label}`;
            item.addEventListener('click', () => {
                adminHubActiveCategory = 'cat_' + cat.id;
                renderAdminHub();
            });
            adminHubSidebar.append(item);
        });
    }

    const divider2 = document.createElement('div');
    divider2.className = 'admin-hub-sidebar-divider';
    const manageItem = document.createElement('div');
    manageItem.className = 'admin-hub-sidebar-item' + (adminHubActiveCategory === '_manage' ? ' active' : '');
    manageItem.style.color = '#c45e20';
    manageItem.innerHTML = '<span class="icon">➕</span> Manage';
    manageItem.addEventListener('click', () => {
        adminHubActiveCategory = '_manage';
        renderAdminHub();
    });
    adminHubSidebar.append(divider2, manageItem);

    if (!adminHubActiveCategory) {
        adminHubActiveCategory = hasBuiltIn ? '_builtin_exchange' : (adminHubCategories.length > 0 ? 'cat_' + adminHubCategories[0].id : '_manage');
    }

    renderAdminHubContent();
}

function renderAdminHubContent() {
    adminHubCommandGrid.innerHTML = '';

    if (adminHubActiveCategory === '_manage') {
        adminHubContentHeader.querySelector('h2').textContent = 'Manage';
        adminHubContentHeader.querySelector('p').textContent = 'Add, edit, or remove categories and custom commands';

        const addCatCard = createAdminHubCard('📂', 'Add Category', 'Create a new command category', null, () => openAdminHubCategoryModal());
        const editCatCard = createAdminHubCard('✏️', 'Edit Categories', 'Rename or reorder categories', null, () => openAdminHubCategoryListModal());
        const addCmdCard = createAdminHubCard('🔗', 'Add Custom Command', 'Register a new command', 'admin only', () => openAdminHubCommandModal());

        adminHubCommandGrid.append(addCatCard, editCatCard, addCmdCard);
        return;
    }

    let commands = [];
    let catLabel = '';
    let catDesc = '';

    if (adminHubActiveCategory === '_builtin_exchange') {
        commands = adminHubBuiltIn;
        catLabel = 'Exchange';
        catDesc = 'Manage item exchange trades, buyers, peds, and vehicles';
    } else if (adminHubActiveCategory && adminHubActiveCategory.startsWith('cat_')) {
        const catId = parseInt(adminHubActiveCategory.replace('cat_', ''));
        const cat = adminHubCategories.find(c => c.id === catId);
        if (cat) {
            catLabel = cat.label;
            catDesc = 'Custom commands in this category';
            commands = adminHubCustomCommands.filter(c => c.category_id === catId).map(c => ({
                ...c,
                id: 'custom_' + c.id,
                isCustom: true,
                customId: c.id
            }));
        }
    }

    adminHubContentHeader.querySelector('h2').textContent = catLabel;
    adminHubContentHeader.querySelector('p').textContent = catDesc;

    commands.forEach((cmd) => {
        const badge = cmd.isCustom ? cmd.command : cmd.command;
        const card = createAdminHubCard(
            cmd.icon || '⚙️',
            cmd.title,
            cmd.description || '',
            badge,
            () => {
                if (cmd.isCustom) {
                    if (cmd.parameters === 'true') {
                        openAdminHubParamInputModal(cmd);
                    } else {
                        closeMenu();
                        setTimeout(() => postNui('adminHubRunCustomCommand', { command: cmd.command, id: cmd.customId }), 100);
                    }
                } else {
                    // Don't close menu for built-in commands - just switch panels
                    postNui('adminHubRunBuiltIn', { command: cmd.command });
                }
            }
        );

        if (cmd.isCustom) {
            const actions = document.createElement('div');
            actions.style.cssText = 'display:flex;gap:4px;margin-top:8px;';
            const editBtn = document.createElement('button');
            editBtn.className = 'btn btn-cancel';
            editBtn.style.cssText = 'font-size:10px;padding:4px 10px;';
            editBtn.textContent = 'Edit';
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                openAdminHubCommandModal(cmd.customId);
            });
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'btn btn-cancel';
            deleteBtn.style.cssText = 'font-size:10px;padding:4px 10px;color:#e05555;';
            deleteBtn.textContent = 'Delete';
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                showAdminHubConfirm('Delete Command', `Delete "${cmd.title}"?`, () => {
                    postNui('adminHubDeleteCommand', { id: cmd.customId });
                });
            });
            actions.append(editBtn, deleteBtn);
            card.append(actions);
        }

        adminHubCommandGrid.append(card);
    });

    if (!adminHubActiveCategory.startsWith('_builtin_')) {
        const addCard = document.createElement('div');
        addCard.className = 'admin-hub-cmd-card add-card';
        addCard.innerHTML = '<div class="cmd-icon">+</div><div class="cmd-title">Add Command</div>';
        addCard.addEventListener('click', () => openAdminHubCommandModal());
        adminHubCommandGrid.append(addCard);
    }
}

function createAdminHubCard(icon, title, description, badge, onClick) {
    const card = document.createElement('div');
    card.className = 'admin-hub-cmd-card';
    card.innerHTML = `
        <div class="cmd-icon">${icon}</div>
        <div class="cmd-title">${title}</div>
        <div class="cmd-desc">${description}</div>
        ${badge ? `<div class="cmd-badge">${badge}</div>` : ''}
    `;
    card.addEventListener('click', onClick);
    return card;
}

function showAdminHubConfirm(title, text, onConfirm) {
    adminHubConfirmTitle.textContent = title;
    adminHubConfirmText.textContent = text;
    adminHubConfirmModal.classList.add('visible');

    const cleanup = () => {
        adminHubConfirmModal.classList.remove('visible');
        adminHubConfirmOk.replaceWith(adminHubConfirmOk.cloneNode(true));
        adminHubConfirmCancel.replaceWith(adminHubConfirmCancel.cloneNode(true));
        adminHubConfirmClose.replaceWith(adminHubConfirmClose.cloneNode(true));
    };

    document.getElementById('admin-hub-confirm-ok').addEventListener('click', () => { cleanup(); onConfirm(); });
    document.getElementById('admin-hub-confirm-cancel').addEventListener('click', cleanup);
    document.getElementById('admin-hub-confirm-close').addEventListener('click', cleanup);
}

function openAdminHubCategoryModal(editCat) {
    adminHubModalMode = 'category';
    adminHubEditingId = editCat ? editCat.id : null;
    adminHubModalTitle.textContent = editCat ? 'Edit Category' : 'Add Category';
    adminHubModalBody.innerHTML = `
        <div class="form-row">
            <label>Category Name</label>
            <input type="text" id="hub-cat-label" placeholder="e.g. Server Tools" value="${editCat ? editCat.label : ''}">
        </div>
        <div class="form-row-inline">
            <div class="form-row">
                <label>Icon</label>
                <div class="icon-picker" id="hub-cat-icon-picker">${adminHubIconOptions.map(icon => `<div class="icon-chip${(!editCat || !editCat.icon || editCat.icon === icon) && icon === (editCat ? editCat.icon : '⚙️') ? ' selected' : ''}" data-icon="${icon}">${icon}</div>`).join('')}</div>
            </div>
            <div class="form-row">
                <label>Sort Order</label>
                <input type="number" id="hub-cat-sort" value="${editCat ? (editCat.sort_order || 0) : 0}" min="0">
            </div>
        </div>
    `;
    setupIconPicker('hub-cat-icon-picker');
    adminHubModal.classList.add('visible');
}

function openAdminHubCategoryListModal() {
    adminHubModalMode = 'categoryList';
    adminHubModalTitle.textContent = 'Manage Categories';
    adminHubModalBody.innerHTML = '';

    if (adminHubCategories.length === 0) {
        adminHubModalBody.innerHTML = '<p style="color:#777;font-size:13px;text-align:center;padding:20px 0">No custom categories yet.</p>';
    } else {
        adminHubCategories.forEach((cat) => {
            const row = document.createElement('div');
            row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:#1c1c1c;border:1px solid #2a2a2a;border-radius:6px;';
            row.innerHTML = `
                <span style="font-size:13px;color:#f2f5f1">${cat.icon || '⚙️'} ${cat.label}</span>
                <div style="display:flex;gap:4px;">
                    <button class="btn btn-cancel hub-cat-edit" style="font-size:10px;padding:4px 10px;" data-id="${cat.id}">Edit</button>
                    <button class="btn btn-cancel hub-cat-delete" style="font-size:10px;padding:4px 10px;color:#e05555;" data-id="${cat.id}">Delete</button>
                </div>
            `;
            row.querySelector('.hub-cat-edit').addEventListener('click', () => {
                adminHubModal.classList.remove('visible');
                openAdminHubCategoryModal(cat);
            });
            row.querySelector('.hub-cat-delete').addEventListener('click', () => {
                adminHubModal.classList.remove('visible');
                showAdminHubConfirm('Delete Category', `Delete "${cat.label}" and all its commands?`, () => {
                    postNui('adminHubDeleteCategory', { id: cat.id });
                });
            });
            adminHubModalBody.append(row);
        });
    }
    adminHubModal.classList.add('visible');
}

function openAdminHubParamInputModal(cmd) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay visible';
    modal.innerHTML = `
        <div class="modal" style="width:400px;">
            <div class="modal-header">
                <h3>Parameters for ${cmd.title}</h3>
                <button class="modal-close">x</button>
            </div>
            <div class="modal-body">
                <p style="font-size:12px;color:#999;margin-bottom:12px;">Enter parameter values (space separated):</p>
                <div class="form-row">
                    <input type="text" id="param-single" placeholder="e.g. player123 30 minutes" style="width:100%;">
                    ${cmd.example ? `<div class="form-hint">Example: ${cmd.example}</div>` : ''}
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-cancel" id="param-cancel">Cancel</button>
                <button class="btn btn-primary" id="param-submit">Run Command</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    const cleanup = () => {
        modal.remove();
    };

    modal.querySelector('.modal-close').addEventListener('click', cleanup);
    modal.querySelector('#param-cancel').addEventListener('click', cleanup);
    modal.addEventListener('click', (e) => { if (e.target === modal) cleanup(); });

    modal.querySelector('#param-submit').addEventListener('click', () => {
        const input = modal.querySelector('#param-single');
        const val = input.value.trim();
        if (!val) {
            alert('Please enter parameter values');
            return;
        }
        const fullCommand = cmd.command + ' ' + val;
        cleanup();
        closeMenu();
        setTimeout(() => postNui('adminHubRunCustomCommand', { command: fullCommand, id: cmd.customId }), 100);
    });
}

function openAdminHubCommandModal(editId) {
    adminHubModalMode = 'command';
    const editCmd = editId ? adminHubCustomCommands.find(c => c.id === editId) : null;
    adminHubEditingId = editId || null;
    adminHubModalTitle.textContent = editCmd ? 'Edit Command' : 'Add Custom Command';

    const catOptions = adminHubCategories.map(c => `<option value="${c.id}"${editCmd && editCmd.category_id === c.id ? ' selected' : ''}>${c.label}</option>`).join('');
    const permOptions = adminHubPermissionOptions.map(p => `<option value="${p.value}"${editCmd && editCmd.permission === p.value ? ' selected' : ''}>${p.label}</option>`).join('');

    adminHubModalBody.innerHTML = `
        <div class="form-row">
            <label>Command Name</label>
            <input type="text" id="hub-cmd-title" placeholder="e.g. Restart Server" value="${editCmd ? editCmd.title : ''}">
        </div>
        <div class="form-row">
            <label>Description</label>
            <input type="text" id="hub-cmd-desc" placeholder="What this command does" value="${editCmd ? (editCmd.description || '') : ''}">
        </div>
        <div class="form-row-inline">
            <div class="form-row">
                <label>Category</label>
                <select id="hub-cmd-category">${catOptions}</select>
            </div>
            <div class="form-row">
                <label>Permission</label>
                <select id="hub-cmd-permission">${permOptions}</select>
            </div>
        </div>
        <div class="form-row">
            <label>Command to Run</label>
            <input type="text" id="hub-cmd-command" placeholder="e.g. /jail" value="${editCmd ? editCmd.command : ''}">
            <div class="form-hint">Command name (leading / is added automatically)</div>
        </div>
        <div class="form-row">
            <label style="display:flex;align-items:center;gap:8px;">
                <input type="checkbox" id="hub-cmd-has-params" ${editCmd && editCmd.parameters ? 'checked' : ''}>
                <span>Has Parameters</span>
            </label>
        </div>
        <div class="form-row" id="hub-cmd-example-row" style="${editCmd && editCmd.parameters ? '' : 'display:none'}">
            <label>Example Format</label>
            <input type="text" id="hub-cmd-example" placeholder="e.g. id time or [job_name] [min_job_grade]" value="${editCmd ? (editCmd.example || '') : ''}">
            <div class="form-hint">Example format shown in parameter prompt (e.g., id time, [job_name] [min_job_grade], plate)</div>
        </div>
        <div class="form-row">
            <label>Icon</label>
            <div class="icon-picker" id="hub-cmd-icon-picker">${adminHubIconOptions.map(icon => `<div class="icon-chip${(editCmd && editCmd.icon === icon) || (!editCmd && icon === '⚙️') ? ' selected' : ''}" data-icon="${icon}">${icon}</div>`).join('')}</div>
        </div>
        <div class="form-row">
            <label>Confirmation Prompt</label>
            <input type="text" id="hub-cmd-confirm" placeholder="e.g. Are you sure? (leave blank to skip)" value="${editCmd ? (editCmd.confirm_prompt || '') : ''}">
        </div>
    `;
    setupIconPicker('hub-cmd-icon-picker');
    // Toggle parameters row and example row visibility
    const hasParamsCheckbox = document.getElementById('hub-cmd-has-params');
    const paramsRow = document.getElementById('hub-cmd-params-row');
    const exampleRow = document.getElementById('hub-cmd-example-row');
    if (hasParamsCheckbox) {
        const toggle = () => {
            const show = hasParamsCheckbox.checked;
            if (paramsRow) paramsRow.style.display = show ? '' : 'none';
            if (exampleRow) exampleRow.style.display = show ? '' : 'none';
        };
        hasParamsCheckbox.addEventListener('change', toggle);
        // Initial state
        toggle();
    }
    adminHubModal.classList.add('visible');
}

function setupIconPicker(pickerId) {
    const picker = document.getElementById(pickerId);
    if (!picker) return;
    picker.querySelectorAll('.icon-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            picker.querySelectorAll('.icon-chip').forEach(c => c.classList.remove('selected'));
            chip.classList.add('selected');
        });
    });
}

function getSelectedIcon(pickerId) {
    const picker = document.getElementById(pickerId);
    if (!picker) return '⚙️';
    const sel = picker.querySelector('.icon-chip.selected');
    return sel ? sel.dataset.icon : '⚙️';
}

adminHubModalClose.addEventListener('click', () => adminHubModal.classList.remove('visible'));
adminHubModalCancel.addEventListener('click', () => adminHubModal.classList.remove('visible'));
adminHubModal.addEventListener('click', (e) => { if (e.target === adminHubModal) adminHubModal.classList.remove('visible'); });
adminHubConfirmModal.addEventListener('click', (e) => { if (e.target === adminHubConfirmModal) adminHubConfirmModal.classList.remove('visible'); });

adminHubModalSave.addEventListener('click', () => {
    if (adminHubModalMode === 'category') {
        const label = document.getElementById('hub-cat-label').value.trim();
        if (!label) return;
        const data = {
            label: label,
            icon: getSelectedIcon('hub-cat-icon-picker'),
            sort_order: document.getElementById('hub-cat-sort').value
        };
        if (adminHubEditingId) {
            data.id = adminHubEditingId;
            postNui('adminHubUpdateCategory', data);
        } else {
            postNui('adminHubAddCategory', data);
        }
    } else if (adminHubModalMode === 'command') {
        const cmdTitle = document.getElementById('hub-cmd-title').value.trim();
        const cmdCommand = document.getElementById('hub-cmd-command').value.trim();
        if (!cmdTitle || !cmdCommand) return;
        const data = {
            title: cmdTitle,
            description: document.getElementById('hub-cmd-desc').value.trim(),
            category_id: document.getElementById('hub-cmd-category').value,
            command: cmdCommand,
            parameters: document.getElementById('hub-cmd-has-params').checked ? 'true' : 'false',
            example: document.getElementById('hub-cmd-example').value.trim(),
            icon: getSelectedIcon('hub-cmd-icon-picker'),
            permission: document.getElementById('hub-cmd-permission').value,
            confirm_prompt: document.getElementById('hub-cmd-confirm').value.trim()
        };
        if (adminHubEditingId) {
            data.id = adminHubEditingId;
            postNui('adminHubUpdateCommand', data);
        } else {
            postNui('adminHubAddCommand', data);
        }
    }
    adminHubModal.classList.remove('visible');
});

adminHubCloseButton.addEventListener('click', closeMenu);

window.addEventListener('message', (event) => {
    const data = event.data;
    const adminHubDebug = data.debug === true;

    if (adminHubDebug) console.log('[AdminHub] NUI message received:', event.data);

    if (data.action === 'openAdminHub') {
        adminHubPermissions = data.permissions || {};
        adminHubBuiltIn = Array.isArray(data.builtIn) ? data.builtIn : [];
        adminHubCategories = Array.isArray(data.categories) ? data.categories : [];
        adminHubCustomCommands = Array.isArray(data.customCommands) ? data.customCommands : [];
        adminHubActiveCategory = null;
        body.classList.add('is-admin-hub');
        renderAdminHub();
        openPanel();
        return;
    }

    if (data.action === 'refreshAdminHub') {
        postNui('adminHubFetchData');
        return;
    }

    if (data.action === 'adminHubUpdateData') {
        adminHubCategories = Array.isArray(data.categories) ? data.categories : [];
        adminHubCustomCommands = Array.isArray(data.customCommands) ? data.customCommands : [];
        renderAdminHub();
        return;
    }

    if (data.action === 'openAdmin') {
        title.textContent = data.title || 'Exchange Admin';
        trades = Array.isArray(data.trades) ? data.trades : [];
        adminItems = Array.isArray(data.items) ? data.items : [];
        adminPeds = Array.isArray(data.peds) ? data.peds : [];
        editingTrade = editingTrade ? trades.find((trade) => trade.index === editingTrade.index) || null : null;
        renderAdmin();
        openPanel();
        return;
    }

    if (data.action === 'openBuyerAdmin') {
        title.textContent = data.title || 'Buyer Admin';
        buyers = Array.isArray(data.buyers) ? data.buyers : [];
        adminItems = Array.isArray(data.items) ? data.items : [];
        adminPeds = Array.isArray(data.peds) ? data.peds : [];
        activeBuyerItemFilter = '';
        editingBuyer = editingBuyer ? buyers.find((buyer) => buyer.index === editingBuyer.index) || null : null;
        renderBuyerAdmin();
        openPanel();
        return;
    }

    if (data.action === 'openPedAdmin') {
        title.textContent = data.title || 'Ped Admin';
        pedAdminPeds = Array.isArray(data.peds) ? data.peds : [];
        if (data.restore && pedAdminFormCache) {
            editingPed = pedAdminFormCache.editingIndex != null ? pedAdminPeds.find((ped) => ped.index === pedAdminFormCache.editingIndex) || null : null;
        } else {
            editingPed = editingPed ? pedAdminPeds.find((ped) => ped.index === editingPed.index) || null : null;
            pedAdminFormCache = null;
        }
        renderPedAdmin();
        openPanel();
        return;
    }

    if (data.action === 'restorePedAdmin') {
        title.textContent = data.title || 'Ped Admin';
        pedAdminPeds = Array.isArray(data.peds) ? data.peds : [];
        if (pedAdminFormCache) {
            editingPed = pedAdminFormCache.editingIndex != null ? pedAdminPeds.find((ped) => ped.index === pedAdminFormCache.editingIndex) || null : null;
        }
        renderPedAdmin();
        openPanel();
        return;
    }

    if (data.action === 'openVehicleAdmin') {
        title.textContent = data.title || 'Vehicle Spawner Admin';
        vehicleSpawnerCerts = Array.isArray(data.certs) ? data.certs : [];
        vehicleSpawnerVehicles = Array.isArray(data.vehicles) ? data.vehicles : [];
        if (data.restore && vehicleAdminFormCache) {
            activeVehicleAdminTab = vehicleAdminFormCache.tab || 'licenses';
        } else {
            activeVehicleAdminTab = 'licenses';
            vehicleAdminFormCache = null;
        }
        renderVehicleAdmin();
        openPanel();
        return;
    }

    if (data.action === 'restoreVehicleAdmin') {
        title.textContent = data.title || 'Vehicle Spawner Admin';
        vehicleSpawnerCerts = Array.isArray(data.certs) ? data.certs : [];
        vehicleSpawnerVehicles = Array.isArray(data.vehicles) ? data.vehicles : [];
        if (vehicleAdminFormCache) {
            activeVehicleAdminTab = vehicleAdminFormCache.tab || 'licenses';
        }
        renderVehicleAdmin();
        openPanel();
        return;
    }

    if (data.action === 'tradeCompleted') {
        trades.forEach((trade) => {
            if (trade.cost?.item === data.costItem) {
                trade.owned = Math.max(0, Number(trade.owned || 0) - Number(data.costCount || 0));
            }
            if (trade.cost?.item === data.receiveItem) {
                trade.owned = Number(trade.owned || 0) + Number(data.receiveCount || 0);
            }
        });
        renderTrades();
        return;
    }

    if (data.action === 'buyerSold') {
        const buyer = buyers.find((entry) => Number(entry.index) === Number(data.index));
        if (buyer) {
            buyer.owned = Math.max(0, Number(buyer.owned || 0) - Number(data.itemCount || 0));
            renderBuyers();
        }
        return;
    }

    if (data.action === 'openBuyer') {
        title.textContent = data.title || 'Item Buyer';
        buyers = Array.isArray(data.buyers) ? data.buyers : [];
        buyerSearchQuery = '';
        renderBuyers();
        openPanel();
        return;
    }

    if (data.action !== 'open') {
        return;
    }

    title.textContent = data.title || 'Item Exchange';
    trades = Array.isArray(data.trades) ? data.trades : [];
    renderTrades();
    openPanel();
});

closeButton.addEventListener('click', closeMenu);

minimizeButton.addEventListener('click', () => {
    if (body.classList.contains('is-vehicle-admin')) {
        saveVehicleAdminFormState();
        body.classList.remove('is-open');
        body.classList.remove('is-vehicle-admin');
        panel.setAttribute('aria-hidden', 'true');
        minimizeButton.style.display = 'none';
        postNui('vehicleAdminMinimize');
    } else if (body.classList.contains('is-ped-admin')) {
        savePedAdminFormState();
        body.classList.remove('is-open');
        body.classList.remove('is-ped-admin');
        panel.setAttribute('aria-hidden', 'true');
        minimizeButton.style.display = 'none';
        postNui('pedAdminMinimize');
    }
});

window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        closeMenu();
    }
});