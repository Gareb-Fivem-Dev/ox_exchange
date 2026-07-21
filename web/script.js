const resourceName = typeof GetParentResourceName === 'function' ? GetParentResourceName() : 'item_exchange';
const body = document.body;
const panel = document.querySelector('.panel');
const eyebrow = document.querySelector('.eyebrow');
const title = document.querySelector('#menu-title');
const tradeList = document.querySelector('#trade-list');
const closeButton = document.querySelector('#close-button');

let trades = [];
let buyers = [];
let adminItems = [];
let editingTrade = null;
let editingBuyer = null;
let editingPed = null;
let adminPeds = [];
let pedAdminPeds = [];
let activeAdminTab = 'trades';
let activeBuyerAdminTab = 'offers';

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
    panel.setAttribute('aria-hidden', 'true');
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
    eyebrow.textContent = '';
    tradeList.className = 'trade-list';
    tradeList.replaceChildren(...trades.map(createTradeCard));
}

function createBuyerCard(buyer) {
    const card = document.createElement('article');
    card.className = 'trade-card buyer-card';

    const itemLabel = buyer.item.label || buyer.item.name;
    card.innerHTML = `
        <div class="trade-card__swap buyer-card__swap">
            <div class="pill"><img alt=""><div><strong></strong><span></span></div></div>
            <span class="arrow">for</span>
            <div class="pill cash-pill"><div><strong></strong><span>cash</span></div></div>
        </div>
        <div class="trade-card__controls">
            <label>
                Amount
                <input type="number" min="1" step="1" value="1" inputmode="numeric">
            </label>
            <button class="trade-button" type="button">Sell</button>
        </div>
    `;

    const image = card.querySelector('img');
    image.src = buyer.item.image;
    image.alt = itemLabel;
    image.addEventListener('error', () => image.classList.add('is-hidden'));
    card.querySelector('.pill strong').textContent = `${buyer.item.count}x`;
    card.querySelector('.pill span').textContent = itemLabel;
    card.querySelector('.cash-pill strong').textContent = `$${buyer.price}`;

    const amountInput = card.querySelector('input');
    const sellButton = card.querySelector('button');

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
    eyebrow.textContent = '';
    tradeList.className = 'trade-list buyer-list';
    tradeList.replaceChildren(...buyers.map(createBuyerCard));
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

    return ped.type === 'buyer' ? ped.buyer || 1 : ped.trader || 1;
}

function createPedAdminForm(ped = null) {
    const form = document.createElement('form');
    form.className = 'admin-form ped-admin-form';
    form.dataset.mode = ped ? 'edit' : 'add';

    const coords = ped?.coords || {};
    const pedType = ped?.type || (ped?.buyer ? 'buyer' : 'trader');

    form.innerHTML = `
        <h2>${ped ? `Edit Ped #${ped.index}` : 'Add Ped'}</h2>
        <div class="admin-grid ped-admin-grid">
            <label>Type<select name="type" required><option value="trader">Trader</option><option value="buyer">Buyer</option></select></label>
            <label>Group ID<input name="groupId" type="number" min="1" step="1" value="${getPedGroup(ped)}" required></label>
            <label>Model<input name="model" type="text" placeholder="s_m_m_dockwork_01" value="${ped?.model || ''}" required></label>
            <label>X<input name="x" type="number" step="0.0001" value="${coords.x ?? ''}" required></label>
            <label>Y<input name="y" type="number" step="0.0001" value="${coords.y ?? ''}" required></label>
            <label>Z<input name="z" type="number" step="0.0001" value="${coords.z ?? ''}" required></label>
            <label>Heading<input name="w" type="number" step="0.0001" value="${coords.w ?? 0}" required></label>
            <label>Scenario<input name="scenario" type="text" placeholder="WORLD_HUMAN_CLIPBOARD" value="${ped?.scenario || ''}"></label>
            <label>Target Label<input name="targetLabel" type="text" placeholder="Trader" value="${ped?.targetLabel || ''}" required></label>
            <label>Target Icon<input name="targetIcon" type="text" placeholder="fa-solid fa-hand-holding-dollar" value="${ped?.targetIcon || ''}"></label>
            <label class="admin-wide">Menu Title<input name="menuTitle" type="text" placeholder="Item Exchange" value="${ped?.menuTitle || ''}" required></label>
        </div>
    `;

    form.querySelector('select[name="type"]').value = pedType;

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

    const submit = document.createElement('button');
    submit.className = 'trade-button admin-submit';
    submit.type = 'submit';
    submit.textContent = ped ? 'Save Ped' : 'Add Ped';

    form.append(useCurrent, submit);

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
            menuTitle: formData.get('menuTitle')
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
    const titleText = ped.menuTitle || ped.targetLabel || `${ped.type === 'buyer' ? 'Buyer' : 'Trader'} ${getPedGroup(ped)}`;

    row.querySelector('h3').textContent = `[${ped.index}] ${titleText}`;
    row.querySelector('p').textContent = `${ped.enabled ? 'Enabled' : 'Disabled'} - ${ped.type || 'trader'} ${getPedGroup(ped)} - ${ped.model || 'ped'} - ${Number(coords.x || 0).toFixed(2)}, ${Number(coords.y || 0).toFixed(2)}, ${Number(coords.z || 0).toFixed(2)}`;

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

    tabs.append(offersTab, pedsTab);

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
    } else {
        adminShell.append(createBuyerAdminForm(editingBuyer), offerPanel);
    }

    tradeList.replaceChildren(adminShell);
}

function renderPedAdmin() {
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

    if (data.action === 'openBuyer') {
        title.textContent = data.title || 'Item Buyer';
        buyers = Array.isArray(data.buyers) ? data.buyers : [];
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