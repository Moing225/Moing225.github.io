(function () {
  'use strict';

  var doc = document;

  function setupLogoFallbacks() {
    var images = doc.querySelectorAll('.logo-shell img');
    Array.prototype.forEach.call(images, function (img) {
      var shell = img.closest('.logo-shell') || img.parentElement;
      if (!shell) {
        return;
      }

      function showFallback() {
        shell.classList.add('is-missing');
        shell.classList.remove('is-loaded');
        img.hidden = true;
      }

      function markLoaded() {
        if (img.naturalWidth > 0) {
          shell.classList.remove('is-missing');
          shell.classList.add('is-loaded');
        } else {
          showFallback();
        }
      }

      if (img.complete) {
        markLoaded();
      } else {
        img.addEventListener('load', markLoaded, { once: true });
        img.addEventListener('error', showFallback, { once: true });
      }
    });
  }

  function toText(value, fallback) {
    if (value === null || value === undefined) {
      return fallback || '';
    }
    var text = String(value).trim();
    return text || (fallback || '');
  }

  function normaliseSearch(value) {
    try {
      return String(value === null || value === undefined ? '' : value)
        .normalize('NFKC')
        .toLowerCase()
        .replace(/\s+/g, '');
    } catch (error) {
      return String(value === null || value === undefined ? '' : value)
        .toLowerCase()
        .replace(/\s+/g, '');
    }
  }

  function roundMoney(value) {
    return Math.round(value * 100) / 100;
  }

  function parseAmount(value) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return roundMoney(value);
    }
    if (typeof value === 'string') {
      var cleaned = value.replace(/[^0-9.-]/g, '');
      if (!cleaned) {
        return NaN;
      }
      var parsed = Number(cleaned);
      return Number.isFinite(parsed) ? roundMoney(parsed) : NaN;
    }
    return NaN;
  }

  function readRegistry() {
    var raw = window.__SHAREHOLDERS__;
    var meta = raw && raw.meta && typeof raw.meta === 'object' ? raw.meta : {};
    var rows = [];

    if (!raw || !Array.isArray(raw.shareholders)) {
      return {
        available: false,
        hasRows: false,
        rows: rows,
        meta: meta,
        total: null,
        source: toText(meta.source, ''),
        updated: toText(meta.updated, '')
      };
    }

    rows = raw.shareholders
      .map(function (entry, index) {
        if (!entry || typeof entry !== 'object') {
          return null;
        }
        var name = toText(entry.name, '');
        var amount = parseAmount(entry.amount);
        if (!name || !Number.isFinite(amount) || amount < 0) {
          return null;
        }
        return {
          name: name,
          amount: amount,
          originalIndex: index,
          searchName: normaliseSearch(name)
        };
      })
      .filter(Boolean)
      .sort(function (a, b) {
        return b.amount - a.amount || a.originalIndex - b.originalIndex;
      });

    var computedTotal = roundMoney(rows.reduce(function (sum, row) {
      return sum + row.amount;
    }, 0));

    var metaTotal = parseAmount(meta.total);
    var total = Number.isFinite(metaTotal) && metaTotal >= 0 ? metaTotal : computedTotal;

    var rank = 0;
    var previousAmount = null;
    rows.forEach(function (row, index) {
      if (index === 0 || row.amount !== previousAmount) {
        rank = index + 1;
      }
      row.rank = rank;
      previousAmount = row.amount;
    });

    var tieCounts = {};
    rows.forEach(function (row) {
      var key = row.amount.toFixed(2);
      tieCounts[key] = (tieCounts[key] || 0) + 1;
    });
    rows.forEach(function (row) {
      row.tieCount = tieCounts[row.amount.toFixed(2)] || 1;
    });

    return {
      available: true,
      hasRows: rows.length > 0,
      rows: rows,
      meta: meta,
      total: total,
      source: toText(meta.source, ''),
      updated: toText(meta.updated, '')
    };
  }

  var numberFormatter = new Intl.NumberFormat('zh-CN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0
  });

  var decimalFormatter = new Intl.NumberFormat('zh-CN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
  });

  var percentFormatter = new Intl.NumberFormat('zh-CN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
  });

  function formatNumber(value) {
    return numberFormatter.format(value);
  }

  function formatMoneyValue(value) {
    var rounded = roundMoney(value);
    return Number.isInteger(rounded) ? numberFormatter.format(rounded) : decimalFormatter.format(rounded);
  }

  function formatPercent(value) {
    return percentFormatter.format(value) + '%';
  }

  function updateRegistryValues(registry) {
    var keyValues = {
      count: registry.hasRows ? String(registry.rows.length) : '—',
      total: registry.hasRows && Number.isFinite(registry.total) ? formatMoneyValue(registry.total) : '—',
      updated: registry.updated || '—',
      source: registry.source || '—'
    };

    doc.querySelectorAll('[data-registry-value]').forEach(function (node) {
      var key = node.getAttribute('data-registry-value');
      if (Object.prototype.hasOwnProperty.call(keyValues, key)) {
        node.textContent = keyValues[key];
      }
    });
  }

  function fillSummary(registry) {
    if (!registry || !registry.hasRows) {
      return;
    }

    var countElement = doc.getElementById('stat-count');
    var totalElement = doc.getElementById('stat-total');
    var updatedElement = doc.getElementById('stat-updated');

    if (countElement) {
      countElement.textContent = String(registry.rows.length);
    }

    if (updatedElement) {
      updatedElement.textContent = registry.updated || '—';
    }

    if (totalElement && Number.isFinite(registry.total)) {
      totalElement.textContent = formatMoneyValue(registry.total);
    }
  }

  function makeElement(tagName, className, text) {
    var element = doc.createElement(tagName);
    if (className) {
      element.className = className;
    }
    if (text !== undefined) {
      element.textContent = text;
    }
    return element;
  }

  function setRankContent(cell, row) {
    var marker = makeElement('div', 'rank-marker');
    var placeLabels = ['冠军', '亚军', '季军'];
    var tieSuffix = row.tieCount > 1 ? '，并列' : '';
    var screenLabel = '第 ' + row.rank + ' 名';

    if (row.rank <= 3) {
      var medal = makeElement('span', 'medal medal--' + row.rank, String(row.rank));
      medal.setAttribute('aria-hidden', 'true');
      marker.appendChild(medal);

      var caption = makeElement('span', 'rank-caption', placeLabels[row.rank - 1]);
      caption.setAttribute('aria-hidden', 'true');
      marker.appendChild(caption);

      screenLabel += '，' + placeLabels[row.rank - 1];
    } else {
      var number = makeElement('span', 'rank-number', String(row.rank));
      number.setAttribute('aria-hidden', 'true');
      marker.appendChild(number);
    }

    screenLabel += tieSuffix;
    cell.appendChild(marker);
    cell.appendChild(makeElement('span', 'sr-only', screenLabel));
  }

  function createEmptyRow(registry) {
    var tr = doc.createElement('tr');
    tr.className = 'registry-empty-row';
    tr.setAttribute('role', 'row');
    var td = doc.createElement('td');
    td.colSpan = 4;
    td.setAttribute('role', 'cell');

    var wrap = makeElement('div', 'registry-empty');
    var seal = makeElement('span', 'empty-seal', '空');
    seal.setAttribute('aria-hidden', 'true');
    wrap.appendChild(seal);

    var copy = makeElement('div', 'empty-copy-block');
    copy.appendChild(makeElement('strong', '', registry.available ? '名册当前为空' : '名册数据暂未载入'));
    copy.appendChild(makeElement('p', '',
      registry.available
        ? '目前还没有已收录的股东，数据更新后会显示在这里。'
        : '请刷新页面重试；若问题持续，可以稍后再来看看。'
    ));
    wrap.appendChild(copy);
    td.appendChild(wrap);
    tr.appendChild(td);
    return tr;
  }

  function setRegistryUnavailable(registry, summary, filterStatus, filterInput, filterClear) {
    if (summary) {
      summary.textContent = registry.available
        ? '名册当前为空。'
        : '名册数据暂未载入。';
    }
    if (filterStatus) {
      filterStatus.textContent = registry.available ? '暂无名册数据' : '名册数据暂未载入';
    }
    if (filterInput) {
      filterInput.disabled = true;
      filterInput.setAttribute('aria-disabled', 'true');
    }
    if (filterClear) {
      filterClear.hidden = true;
    }
  }

  function buildNoResultsRow() {
    var tr = doc.createElement('tr');
    tr.className = 'no-results-row';
    tr.hidden = true;
    tr.setAttribute('role', 'row');

    var td = doc.createElement('td');
    td.colSpan = 4;
    td.setAttribute('role', 'cell');

    var wrap = makeElement('div', 'no-results');
    var mark = makeElement('span', 'no-results-mark', '未');
    mark.setAttribute('aria-hidden', 'true');
    wrap.appendChild(mark);

    var copy = makeElement('div', 'no-results-copy');
    copy.appendChild(makeElement('p', 'no-results-title', '名册中没有找到这个名字'));
    copy.appendChild(makeElement('p', 'no-results-hint', '请换一个姓名再试，或清除当前检索条件。'));
    wrap.appendChild(copy);

    var clear = makeElement('button', 'button button--quiet no-results-clear', '清除检索');
    clear.type = 'button';
    wrap.appendChild(clear);
    td.appendChild(wrap);
    tr.appendChild(td);
    return tr;
  }

  function setupFiltering(rowsData, tbody, noResultsRow) {
    var filterInput = doc.getElementById('shareholder-filter');
    var filterClear = doc.getElementById('filter-clear');
    var filterStatus = doc.getElementById('filter-status');
    var clearButton = noResultsRow.querySelector('.no-results-clear');

    if (!filterInput || !filterStatus) {
      return;
    }

    function applyFilter(rawQuery) {
      var query = normaliseSearch(rawQuery);
      var matchCount = 0;

      rowsData.forEach(function (entry) {
        var matches = !query || entry.searchName.indexOf(query) !== -1;
        entry.row.hidden = !matches;
        if (matches) {
          matchCount += 1;
        }
      });

      noResultsRow.hidden = matchCount !== 0;
      filterClear.hidden = query.length === 0;
      filterStatus.textContent = query
        ? '找到 ' + matchCount + ' 位股东 · 共 ' + rowsData.length + ' 位'
        : '共 ' + rowsData.length + ' 位股东';
    }

    function clearFilter(shouldFocus) {
      filterInput.value = '';
      applyFilter('');
      filterClear.hidden = true;
      if (shouldFocus !== false) {
        filterInput.focus();
      }
    }

    filterInput.addEventListener('input', function () {
      applyFilter(filterInput.value);
    });

    filterInput.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && filterInput.value) {
        event.preventDefault();
        clearFilter(true);
      }
    });

    if (filterClear) {
      filterClear.addEventListener('click', function () {
        clearFilter(true);
      });
    }

    if (clearButton) {
      clearButton.addEventListener('click', function () {
        clearFilter(true);
      });
    }

    applyFilter('');
  }

  function renderLeaderboard(registry) {
    var tbody = doc.getElementById('registry-body');
    if (!tbody) {
      return;
    }

    var filterStatus = doc.getElementById('filter-status');
    var filterInput = doc.getElementById('shareholder-filter');
    var filterClear = doc.getElementById('filter-clear');
    var summary = doc.getElementById('registry-summary');

    tbody.replaceChildren();

    if (!registry.hasRows) {
      tbody.appendChild(createEmptyRow(registry));
      setRegistryUnavailable(registry, summary, filterStatus, filterInput, filterClear);
      return;
    }

    var rowsData = [];
    var tableFragment = doc.createDocumentFragment();
    var total = Number.isFinite(registry.total) ? registry.total : 0;

    registry.rows.forEach(function (row) {
      var tr = doc.createElement('tr');
      tr.className = 'shareholder-row';
      tr.setAttribute('role', 'row');
      if (row.rank <= 3) {
        tr.classList.add('is-top', 'is-top-' + row.rank);
      }
      tr.dataset.rank = String(row.rank);

      var rankCell = doc.createElement('td');
      rankCell.className = 'cell cell-rank rank-cell';
      rankCell.setAttribute('role', 'cell');
      setRankContent(rankCell, row);

      var nameCell = doc.createElement('td');
      nameCell.className = 'cell cell-name name-cell';
      nameCell.setAttribute('role', 'cell');
      var name = makeElement('span', 'shareholder-name', row.name);
      nameCell.appendChild(name);

      var amountCell = doc.createElement('td');
      amountCell.className = 'cell cell-amount amount-cell';
      amountCell.setAttribute('role', 'cell');
      var amount = makeElement('span', 'amount');
      var currency = makeElement('span', 'amount-currency', '¥');
      currency.setAttribute('aria-hidden', 'true');
      amount.appendChild(currency);
      amount.appendChild(makeElement('span', 'amount-number', formatMoneyValue(row.amount)));
      amountCell.appendChild(amount);

      var sharePercent = total > 0 ? (row.amount / total) * 100 : 0;
      var visibleShare = Math.max(0, Math.min(100, sharePercent));

      var shareCell = doc.createElement('td');
      shareCell.className = 'cell cell-share share-cell';
      shareCell.setAttribute('role', 'cell');
      var shareInner = makeElement('div', 'share-meter');
      shareInner.appendChild(makeElement('span', 'share-percent', formatPercent(sharePercent)));

      var track = makeElement('span', 'share-track');
      track.setAttribute('aria-hidden', 'true');
      var fill = makeElement('span', 'share-fill');
      fill.style.width = visibleShare + '%';
      track.appendChild(fill);
      shareInner.appendChild(track);
      shareCell.appendChild(shareInner);

      tr.appendChild(rankCell);
      tr.appendChild(nameCell);
      tr.appendChild(amountCell);
      tr.appendChild(shareCell);
      tableFragment.appendChild(tr);

      rowsData.push({ row: tr, searchName: row.searchName });
    });

    var noResultsRow = buildNoResultsRow();
    tableFragment.appendChild(noResultsRow);
    tbody.appendChild(tableFragment);

    if (filterStatus) {
      filterStatus.textContent = '共 ' + registry.rows.length + ' 位股东';
    }

    if (summary) {
      summary.textContent = '名册共 ' + registry.rows.length + ' 位股东，累计赞助 ¥' +
        formatMoneyValue(registry.total) + '，数据更新于 ' + (registry.updated || '未知日期') + '。';
    }

    setupFiltering(rowsData, tbody, noResultsRow);
  }

  function init() {
    setupLogoFallbacks();
    var registry = readRegistry();
    updateRegistryValues(registry);
    renderLeaderboard(registry);
    fillSummary(registry);
  }

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
