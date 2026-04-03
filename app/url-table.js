/**
 * URL Table Manager
 * Handles the URL table display, selection, and operations
 */

class UrlTableManager {
  constructor() {
    this.urlTable = document.getElementById('urlTable');
    this.urlTableEmpty = document.getElementById('urlTableEmpty');
    this.urlCountEl = document.getElementById('urlCount');
    this.contextMenu = document.getElementById('urlTableContextMenu');
    this.urlTableHeader = document.querySelector('.url-table-header');

    // Data storage
    this.rows = []; // Array of { id, url, title, duration, thumbnail, series, season, episodeNumber }
    this.selectedRowIds = new Set();

    // Selection state
    this.lastSelectedRowId = null;
    this.isSelectingWithCtrl = false;
    this.isSelectingWithShift = false;

    // Column resize state
    this.isResizing = false;
    this.currentResizingCol = null;
    this.startX = 0;
    this.startWidth = 0;

    // Column widths (persisted)
    this.columnWidths = {
      season: 70,
      title: 300,
      duration: 70,
      url: 150
    };

    // Bind methods
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);
    this.handleContextMenu = this.handleContextMenu.bind(this);
    this.hideContextMenu = this.hideContextMenu.bind(this);
    this.handleResizeStart = this.handleResizeStart.bind(this);
    this.handleResizeMove = this.handleResizeMove.bind(this);
    this.handleResizeEnd = this.handleResizeEnd.bind(this);

    // Initialize
    this.init();
  }

  init() {
    // Global keyboard listeners for multi-selection
    document.addEventListener('keydown', this.handleKeyDown);
    document.addEventListener('keyup', this.handleKeyUp);

    // Context menu listeners
    document.addEventListener('click', this.hideContextMenu);
    document.addEventListener('contextmenu', this.handleContextMenu);

    // Column resize listeners
    this.initColumnResize();

    // Load saved data
    this.loadFromStorage();
  }

  initColumnResize() {
    // Load saved column widths
    const savedWidths = localStorage.getItem('urlTableColumnWidths');
    if (savedWidths) {
      try {
        this.columnWidths = { ...this.columnWidths, ...JSON.parse(savedWidths) };
        this.applyColumnWidths();
      } catch (e) {
        console.error('Failed to load column widths:', e);
      }
    }

    // Add resize handle listeners
    const resizeHandles = document.querySelectorAll('.col-resize-handle');
    resizeHandles.forEach(handle => {
      handle.addEventListener('mousedown', this.handleResizeStart);
      handle.addEventListener('dblclick', this.handleResizeDoubleClick.bind(this));
    });

    // Global mouse move/up for resizing
    document.addEventListener('mousemove', this.handleResizeMove);
    document.addEventListener('mouseup', this.handleResizeEnd);
  }

  handleResizeDoubleClick(e) {
    const col = e.target.dataset.col;
    if (!col) return;

    // Measure the widest content in this column
    let maxWidth = 0;
    const padding = 24; // 12px padding on each side

    // Measure header cell
    const headerCol = this.urlTableHeader.querySelector(`[data-col="${col}"]`);
    if (headerCol) {
      const headerText = headerCol.childNodes[0];
      if (headerText && headerText.nodeType === Node.TEXT_NODE) {
        const textWidth = this.measureTextWidth(headerText.textContent.trim(), headerCol);
        maxWidth = Math.max(maxWidth, textWidth + padding);
      }
    }

    // Measure all row cells
    const rowCols = document.querySelectorAll(`.${col}-col`);
    rowCols.forEach(rowCol => {
      if (rowCol.textContent) {
        const textWidth = this.measureTextWidth(rowCol.textContent, rowCol);
        maxWidth = Math.max(maxWidth, textWidth + padding);
      }
    });

    // Apply the calculated width (with min/max limits)
    const newWidth = Math.min(Math.max(maxWidth, 50), 600);

    // Apply to header
    if (headerCol) {
      headerCol.style.width = newWidth + 'px';
    }

    // Apply to all row columns
    rowCols.forEach(rowCol => {
      rowCol.style.width = newWidth + 'px';
      rowCol.style.flex = 'none';
    });

    // Save the width
    this.columnWidths[col] = newWidth;
    localStorage.setItem('urlTableColumnWidths', JSON.stringify(this.columnWidths));
  }

  measureTextWidth(text, element) {
    const canvas = this.measureCanvas || (this.measureCanvas = document.createElement('canvas'));
    const context = canvas.getContext('2d');
    const style = window.getComputedStyle(element);
    context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    return context.measureText(text).width;
  }

  handleResizeStart(e) {
    e.preventDefault();
    this.isResizing = true;
    this.currentResizingCol = e.target.dataset.col;
    this.startX = e.pageX;

    const colEl = e.target.closest('.url-table-col');
    this.startWidth = colEl.offsetWidth;

    this.urlTableHeader.classList.add('resizing');
    e.target.classList.add('resizing');

    // Store the next column to resize it inversely
    const allCols = Array.from(this.urlTableHeader.querySelectorAll('.url-table-col:not(.thumbnail-col)'));
    const currentIndex = allCols.findIndex(c => c.dataset.col === this.currentResizingCol);
    this.nextCol = currentIndex < allCols.length - 1 ? allCols[currentIndex + 1] : null;
  }

  handleResizeMove(e) {
    if (!this.isResizing) return;

    const diff = e.pageX - this.startX;
    const newWidth = Math.max(50, this.startWidth + diff);

    // Apply width to header column
    const headerCol = this.urlTableHeader.querySelector(`[data-col="${this.currentResizingCol}"]`);
    if (headerCol) {
      headerCol.style.width = newWidth + 'px';
    }

    // Apply width to ALL row columns with matching class
    const rowCols = document.querySelectorAll(`.${this.currentResizingCol}-col`);
    rowCols.forEach(col => {
      col.style.width = newWidth + 'px';
      col.style.flex = 'none';
    });
  }

  getMinimumColumnWidth(col) {
    // Ensure width is never narrower than the widest cell in the column or header text
    const padding = 24; // 12px left+right
    let maxWidth = 0;

    const headerCol = this.urlTableHeader.querySelector(`[data-col="${col}"]`);
    if (headerCol) {
      const headerText = headerCol.textContent.trim();
      const headerWidth = this.measureTextWidth(headerText, headerCol) + padding;
      maxWidth = Math.max(maxWidth, headerWidth);
    }

    const rowCols = document.querySelectorAll(`.${col}-col`);
    rowCols.forEach(rowCol => {
      const text = rowCol.textContent.trim();
      if (text) {
        const textWidth = this.measureTextWidth(text, rowCol) + padding;
        maxWidth = Math.max(maxWidth, textWidth);
      }
    });

    return Math.max(60, maxWidth); // minimum enforce 60px
  }

  handleResizeEnd(e) {
    if (!this.isResizing) return;

    this.isResizing = false;
    this.urlTableHeader.classList.remove('resizing');

    // Remove resizing class from all handles
    document.querySelectorAll('.col-resize-handle').forEach(h => h.classList.remove('resizing'));

    // Save column width with minimum enforcement
    if (this.currentResizingCol) {
      const headerCol = this.urlTableHeader.querySelector(`[data-col="${this.currentResizingCol}"]`);
      if (headerCol) {
        const rawWidth = headerCol.offsetWidth;
        const minWidth = this.getMinimumColumnWidth(this.currentResizingCol);
        const finalWidth = Math.max(rawWidth, minWidth);

        headerCol.style.width = `${finalWidth}px`;

        const rowCols = document.querySelectorAll(`.${this.currentResizingCol}-col`);
        rowCols.forEach(col => {
          col.style.width = `${finalWidth}px`;
          col.style.flex = 'none';
        });

        this.columnWidths[this.currentResizingCol] = finalWidth;
        localStorage.setItem('urlTableColumnWidths', JSON.stringify(this.columnWidths));
      }
    }

    this.currentResizingCol = null;
    this.nextCol = null;
  }

  applyColumnWidths() {
    // Apply saved widths to header columns
    for (const [col, width] of Object.entries(this.columnWidths)) {
      const headerCol = this.urlTableHeader.querySelector(`[data-col="${col}"]`);
      if (headerCol && !headerCol.classList.contains('thumbnail-col')) {
        // enforce min width from current data and header text
        const minWidth = this.getMinimumColumnWidth(col);
        const finalWidth = Math.max(width, minWidth);
        headerCol.style.width = finalWidth + 'px';

        // Apply to row columns
        const rowCols = document.querySelectorAll(`.url-table-row .${col}-col`);
        rowCols.forEach(rowCol => {
          rowCol.style.width = finalWidth + 'px';
          rowCol.style.flex = 'none';
        });

        // Persist adjusted width
        this.columnWidths[col] = finalWidth;
      }
    }

    localStorage.setItem('urlTableColumnWidths', JSON.stringify(this.columnWidths));
  }
  
  handleKeyDown(e) {
    if (e.key === 'Control') {
      this.isSelectingWithCtrl = true;
    }
    if (e.key === 'Shift') {
      this.isSelectingWithShift = true;
    }
    if (e.key === 'a' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      this.selectAll();
    }
    if (e.key === 'Delete' && this.selectedRowIds.size > 0) {
      e.preventDefault();
      this.deleteSelected();
    }
  }
  
  handleKeyUp(e) {
    if (e.key === 'Control') {
      this.isSelectingWithCtrl = false;
    }
    if (e.key === 'Shift') {
      this.isSelectingWithShift = false;
    }
  }
  
  handleContextMenu(e) {
    if (e.target.closest('.url-table-row')) {
      e.preventDefault();
      this.showContextMenu(e.clientX, e.clientY);
    } else {
      this.hideContextMenu();
    }
  }
  
  showContextMenu(x, y) {
    const downloadText = document.getElementById('ctxDownloadSelectionText');
    const exportText = document.getElementById('ctxExportSelectionText');
    const deleteText = document.getElementById('ctxDeleteSelectionText');
    
    const count = this.selectedRowIds.size;
    downloadText.textContent = `Download Selection${count > 1 ? ` (${count})` : ''}`;
    exportText.textContent = `Export Selection${count > 1 ? ` (${count})` : ''}`;
    deleteText.textContent = `Delete Selection${count > 1 ? ` (${count})` : ''}`;
    
    this.contextMenu.style.left = `${x}px`;
    this.contextMenu.style.top = `${y}px`;
    this.contextMenu.classList.add('show');
  }
  
  hideContextMenu() {
    this.contextMenu.classList.remove('show');
  }
  
  // Data operations
  addRows(newRows) {
    let addedCount = 0;

    for (const row of newRows) {
      const existingRow = this.rows.find(r => r.url === row.url);
      const cleanedSeason = row.season ? Number(row.season) : 1;
      const cleanedEpisode = row.episodeNumber || row.episode_number || null;

      if (existingRow) {
        existingRow.title = row.title || existingRow.title || 'Unknown';
        existingRow.duration = row.duration || existingRow.duration || '--:--';
        existingRow.thumbnail = row.thumbnail || existingRow.thumbnail || null;
        existingRow.series = row.series || existingRow.series || 'Unknown Series';
        existingRow.season = cleanedSeason || existingRow.season || 1;
        existingRow.episodeNumber = cleanedEpisode || existingRow.episodeNumber || (() => {
          const match = (existingRow.title || '').match(/(?:S\d+)?[:\s]*E(\d+)/i);
          return match ? Number(match[1]) : 0;
        })();
        console.log('Updated existing row:', { url: existingRow.url, episodeNumber: existingRow.episodeNumber });
      } else {
        const newRow = {
          id: this.generateId(),
          url: row.url,
          title: row.title || 'Unknown',
          duration: row.duration || '--:--',
          thumbnail: row.thumbnail || null,
          series: row.series || 'Unknown Series',
          season: cleanedSeason || 1,
          episodeNumber: cleanedEpisode || (() => {
            const match = (row.title || '').match(/(?:S\d+)?[:\s]*E(\d+)/i);
            return match ? Number(match[1]) : 0;
          })()
        };

        console.log('Adding row to table:', { title: newRow.title, episodeNumber: newRow.episodeNumber });
        this.rows.push(newRow);
        addedCount++;
      }
    }

    this.render();
    this.saveToStorage();
    return addedCount;
  }
  
  deleteSelected() {
    if (this.selectedRowIds.size === 0) return;
    
    this.rows = this.rows.filter(row => !this.selectedRowIds.has(row.id));
    this.selectedRowIds.clear();
    this.lastSelectedRowId = null;
    
    this.render();
    this.saveToStorage();
  }
  
  deleteAll() {
    this.rows = [];
    this.selectedRowIds.clear();
    this.lastSelectedRowId = null;
    
    this.render();
    this.saveToStorage();
  }
  
  // Selection operations
  selectRow(rowId, addToSelection = false, extendSelection = false) {
    const rowIndex = this.rows.findIndex(r => r.id === rowId);
    if (rowIndex === -1) return;
    
    if (extendSelection && this.lastSelectedRowId !== null) {
      // Shift+Click: Select range
      const lastIndex = this.rows.findIndex(r => r.id === this.lastSelectedRowId);
      const start = Math.min(lastIndex, rowIndex);
      const end = Math.max(lastIndex, rowIndex);
      
      if (!addToSelection) {
        this.selectedRowIds.clear();
      }
      
      for (let i = start; i <= end; i++) {
        this.selectedRowIds.add(this.rows[i].id);
      }
    } else if (addToSelection) {
      // Ctrl+Click: Toggle selection
      if (this.selectedRowIds.has(rowId)) {
        this.selectedRowIds.delete(rowId);
      } else {
        this.selectedRowIds.add(rowId);
      }
      this.lastSelectedRowId = rowId;
    } else {
      // Regular click: Select only this row
      this.selectedRowIds.clear();
      this.selectedRowIds.add(rowId);
      this.lastSelectedRowId = rowId;
    }
    
    this.renderRows();
  }
  
  selectAll() {
    this.rows.forEach(row => this.selectedRowIds.add(row.id));
    this.renderRows();
  }
  
  clearSelection() {
    this.selectedRowIds.clear();
    this.lastSelectedRowId = null;
    this.renderRows();
  }
  
  // Get selected URLs
  getSelectedUrls() {
    return this.rows
      .filter(row => this.selectedRowIds.has(row.id))
      .map(row => row.url);
  }
  
  getAllUrls() {
    return this.rows.map(row => row.url);
  }
  
  // Export/Import
  exportToJson(filePath) {
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      urls: this.rows.map(row => ({
        url: row.url,
        title: row.title,
        duration: row.duration,
        series: row.series,
        season: row.season
      }))
    };
    
    return new Promise((resolve, reject) => {
      const fs = require('fs');
      try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        resolve(true);
      } catch (error) {
        reject(error);
      }
    });
  }
  
  exportSelectedToJson(filePath) {
    const selectedRows = this.rows.filter(row => this.selectedRowIds.has(row.id));
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      count: selectedRows.length,
      urls: selectedRows.map(row => ({
        url: row.url,
        title: row.title,
        duration: row.duration,
        series: row.series,
        season: row.season
      }))
    };
    
    return new Promise((resolve, reject) => {
      const fs = require('fs');
      try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        resolve(true);
      } catch (error) {
        reject(error);
      }
    });
  }
  
  importFromJson(filePath) {
    return new Promise((resolve, reject) => {
      const fs = require('fs');
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(content);
        
        if (data.urls && Array.isArray(data.urls)) {
          const addedCount = this.addRows(data.urls);
          resolve(addedCount);
        } else {
          reject(new Error('Invalid JSON format'));
        }
      } catch (error) {
        reject(error);
      }
    });
  }
  
  // Storage
  saveToStorage() {
    localStorage.setItem('urlTableRows', JSON.stringify(this.rows));
  }
  
  loadFromStorage() {
    try {
      const saved = localStorage.getItem('urlTableRows');
      if (saved) {
        this.rows = JSON.parse(saved);
        this.render();
      }
    } catch (error) {
      console.error('Failed to load URL table from storage:', error);
    }
  }
  
  // Rendering
  render() {
    this.updateEmptyState();
    this.renderRows();
    this.updateStats();
  }
  
  updateEmptyState() {
    if (this.rows.length === 0) {
      this.urlTableEmpty.style.display = 'flex';
      this.urlTable.style.display = 'none';
    } else {
      this.urlTableEmpty.style.display = 'none';
      this.urlTable.style.display = 'block';
    }
  }
  
  renderRows() {
    this.urlTable.innerHTML = '';

    for (const row of this.rows) {
      const rowEl = document.createElement('div');
      rowEl.className = 'url-table-row' + (this.selectedRowIds.has(row.id) ? ' selected' : '');
      rowEl.dataset.id = row.id;

      const seasonNum = Number.isFinite(Number(row.season)) ? Number(row.season) : null;
      const episodeNum = Number.isFinite(Number(row.episodeNumber)) ? Number(row.episodeNumber) : null;
      const seasonLabel = seasonNum !== null ? String(seasonNum).padStart(2, '0') : '--';
      const episodeLabel = episodeNum !== null ? String(episodeNum).padStart(2, '0') : '--';

      rowEl.innerHTML = `
        <div class="thumbnail-col">
          ${row.thumbnail ? `<img src="${row.thumbnail}" alt="" onerror="this.style.display='none'">` : ''}
        </div>
        <div class="season-col">S${seasonLabel}E${episodeLabel}</div>
        <div class="title-col" title="${this.escapeHtml(row.title)}">${this.escapeHtml(row.title)}</div>
        <div class="duration-col">${row.duration}</div>
        <div class="url-col" title="${this.escapeHtml(row.url)}">${this.escapeHtml(row.url)}</div>
      `;

      rowEl.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectRow(row.id, this.isSelectingWithCtrl, this.isSelectingWithShift);
      });

      this.urlTable.appendChild(rowEl);
    }

    // Apply column widths after rendering
    this.applyColumnWidths();
  }
  
  updateStats() {
    if (this.urlCountEl) {
      this.urlCountEl.textContent = this.rows.length;
    }
  }
  
  // Utilities
  generateId() {
    return 'row_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
  
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  // Cleanup
  destroy() {
    document.removeEventListener('keydown', this.handleKeyDown);
    document.removeEventListener('keyup', this.handleKeyUp);
    document.removeEventListener('click', this.hideContextMenu);
    document.removeEventListener('contextmenu', this.handleContextMenu);
  }
}

// Export for use in renderer.js
window.UrlTableManager = UrlTableManager;
