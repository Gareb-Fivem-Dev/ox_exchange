const resourceName = typeof GetParentResourceName === 'function' ? GetParentResourceName() : 'item_exchange';
const body = document.body;
const panel = document.querySelector('.panel');
const eyebrow = document.querySelector('.eyebrow');
const title = document.querySelector('#menu-title');
const headerInfo = document.querySelector('.panel__header > div');
const tradeList = document.querySelector('#trade-list');
const closeButton = document.querySelector('#close-button');

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

function postNui(eventName, data = {}) {
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
    panel.setAttribute('aria-hidden', 'true');
    clearBuyerHeaderSearch();
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
    body.classList.add('is-buyer');
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
    body.classList.add('is-admin');
    body.classList.remove('is-buyer');
    body.classList.remove('is-buyer-admin');
    body.classList.remove('is-ped-admin');
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
    body.classList.add('is-buyer-admin');
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
    body.classList.add('is-ped-admin');
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
}

function renderVehicleAdmin() {
    clearBuyerHeaderSearch();
    body.classList.remove('is-admin');
    body.classList.remove('is-buyer');
    body.classList.remove('is-buyer-admin');
    body.classList.remove('is-ped-admin');
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
        renderVehicleAdmin();
    });

    const vehiclesTab = document.createElement('button');
    vehiclesTab.type = 'button';
    vehiclesTab.className = activeVehicleAdminTab === 'vehicles' ? 'admin-tab is-active' : 'admin-tab';
    vehiclesTab.textContent = 'Vehicles';
    vehiclesTab.addEventListener('click', () => {
        activeVehicleAdminTab = 'vehicles';
        renderVehicleAdmin();
    });

    tabs.append(licensesTab, vehiclesTab);

    // Certification Management Section
    const certSection = document.createElement('section');
    certSection.className = 'vehicle-admin-section';
    certSection.innerHTML = '<h2>Licenses</h2>';

    const certList = document.createElement('div');
    certList.className = 'vehicle-admin-list';

    // Add Certification Form
    const addCertForm = document.createElement('div');
    addCertForm.className = 'vehicle-admin-form';
    addCertForm.innerHTML = `
        <h3>Add License</h3>
        <input type="number" class="cert-spawner-id-input" placeholder="Vehicle Spawner ID (blank = all peds)" min="1" />
        <input type="text" class="cert-type-input" placeholder="Cert Type (e.g., heat, moto, k9, air)" />
        <input type="text" class="cert-label-input" placeholder="Label (e.g., Heat License)" />
        <input type="number" class="cert-max-spawned-input" placeholder="Max Spawned" min="1" />
        <button type="button" class="cert-add-button">Add License</button>
    `;

    const certTypeInput = addCertForm.querySelector('.cert-type-input');
    const certSpawnerIdInput = addCertForm.querySelector('.cert-spawner-id-input');
    const certLabelInput = addCertForm.querySelector('.cert-label-input');
    const certMaxSpawnedInput = addCertForm.querySelector('.cert-max-spawned-input');
    const certAddButton = addCertForm.querySelector('.cert-add-button');

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

        postNui('vehicleAdminAddCert', { cert_type: certType, label, max_spawned: maxSpawned, vehicle_spawner_id: spawnerId });
        certSpawnerIdInput.value = '';
        certTypeInput.value = '';
        certLabelInput.value = '';
        certMaxSpawnedInput.value = '';
    });

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
                <button type="button" class="cert-toggle-button">${cert.enabled ? 'Disable' : 'Enable'}</button>
                <button type="button" class="cert-delete-button">Delete</button>
            </div>
        `;

        certRow.querySelector('.cert-toggle-button').addEventListener('click', () => {
            postNui('vehicleAdminToggleCert', { id: cert.id });
        });

        certRow.querySelector('.cert-delete-button').addEventListener('click', () => {
            if (confirm(`Delete license "${cert.cert_type}"?`)) {
                postNui('vehicleAdminDeleteCert', { id: cert.id });
            }
        });

        certList.append(certRow);
    });

    certSection.append(addCertForm, certList);

    // Vehicle Management Section
    const vehicleSection = document.createElement('section');
    vehicleSection.className = 'vehicle-admin-section';
    vehicleSection.innerHTML = '<h2>Vehicles</h2>';

    const vehicleList = document.createElement('div');
    vehicleList.className = 'vehicle-admin-list';

    // Add Vehicle Form
    const addVehicleForm = document.createElement('div');
    addVehicleForm.className = 'vehicle-admin-form';

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

    addVehicleForm.innerHTML = `
        <h3>Add Vehicle</h3>
    `;
    addVehicleForm.append(certSelect);
    addVehicleForm.insertAdjacentHTML('beforeend', `
        <input type="number" class="vehicle-spawner-id-input" placeholder="Vehicle Spawner ID (blank = all peds)" min="1" />
        <input type="text" class="vehicle-model-input" placeholder="Model Name (e.g., granger)" />
        <input type="text" class="vehicle-label-input" placeholder="Label (e.g., Granger)" />
        <input type="number" class="vehicle-livery-input" placeholder="Livery Number (optional)" min="0" step="1" />
        <input type="text" class="vehicle-extras-input" placeholder="Extras (optional, e.g. 1,2,3)" />
        <input type="number" class="vehicle-engine-input" placeholder="Engine Mod (0-4, optional)" min="0" max="4" step="1" />
        <input type="text" class="vehicle-allowed-jobs-input" placeholder="Allowed Jobs/Types (optional, e.g. leo,police,ems)" />
        <button type="button" class="vehicle-add-button">Add Vehicle</button>
    `);

    const vehicleSpawnerIdInput = addVehicleForm.querySelector('.vehicle-spawner-id-input');
    const vehicleModelInput = addVehicleForm.querySelector('.vehicle-model-input');
    const vehicleLabelInput = addVehicleForm.querySelector('.vehicle-label-input');
    const vehicleLiveryInput = addVehicleForm.querySelector('.vehicle-livery-input');
    const vehicleExtrasInput = addVehicleForm.querySelector('.vehicle-extras-input');
    const vehicleEngineInput = addVehicleForm.querySelector('.vehicle-engine-input');
    const vehicleAllowedJobsInput = addVehicleForm.querySelector('.vehicle-allowed-jobs-input');
    const vehicleAddButton = addVehicleForm.querySelector('.vehicle-add-button');

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

        postNui('vehicleAdminAddVehicle', {
            cert_type: certType,
            model,
            label,
            vehicle_spawner_id: spawnerId,
            livery,
            extras,
            mod_engine: engineMod,
            allowed_jobs: allowedJobs
        });
        vehicleSpawnerIdInput.value = '';
        vehicleModelInput.value = '';
        vehicleLabelInput.value = '';
        vehicleLiveryInput.value = '';
        vehicleExtrasInput.value = '';
        vehicleEngineInput.value = '';
        vehicleAllowedJobsInput.value = '';
        certSelect.value = '';
    });

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
                    <button type="button" class="vehicle-toggle-button">${vehicle.enabled ? 'Disable' : 'Enable'}</button>
                    <button type="button" class="vehicle-delete-button">Delete</button>
                </div>
            `;

            vehicleRow.querySelector('.vehicle-toggle-button').addEventListener('click', () => {
                postNui('vehicleAdminToggleVehicle', { id: vehicle.id });
            });

            vehicleRow.querySelector('.vehicle-delete-button').addEventListener('click', () => {
                if (confirm(`Delete vehicle "${vehicle.label}"?`)) {
                    postNui('vehicleAdminDeleteVehicle', { id: vehicle.id });
                }
            });

            vehicleList.append(vehicleRow);
        });
    });

    vehicleSection.append(addVehicleForm, vehicleList);

    adminShell.append(tabs);

    if (activeVehicleAdminTab === 'vehicles') {
        adminShell.append(vehicleSection);
    } else {
        adminShell.append(certSection);
    }

    tradeList.replaceChildren(adminShell);
}

window.addEventListener('message', (event) => {
    const data = event.data;

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
        editingPed = editingPed ? pedAdminPeds.find((ped) => ped.index === editingPed.index) || null : null;
        renderPedAdmin();
        openPanel();
        return;
    }

    if (data.action === 'openVehicleAdmin') {
        title.textContent = data.title || 'Vehicle Spawner Admin';
        vehicleSpawnerCerts = Array.isArray(data.certs) ? data.certs : [];
        vehicleSpawnerVehicles = Array.isArray(data.vehicles) ? data.vehicles : [];
        activeVehicleAdminTab = 'licenses';
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

window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        closeMenu();
    }
});