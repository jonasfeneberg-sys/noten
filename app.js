/**
 * Notenrechner - Anwendungslogik & Zustandsverwaltung
 * - Dauerhafte lokale Speicherung (localStorage)
 * - Multi-Schuljahr-Verwaltung (Alte Schuljahre bleiben erhalten)
 * - Exakte 2:1 Schnittberechnung für Hauptfächer & 1-fach für Nebenfächer
 * - Backup Export & Import (JSON)
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'notenrechner_app_data_v2';

  // --- Initialer Zustand (falls keine Daten gespeichert sind) ---
  const defaultInitialState = {
    activeYearId: 'year-2024-2025',
    years: [
      {
        id: 'year-2024-2025',
        name: '2024 / 2025',
        subjects: [
          { id: 'subj-1', name: 'Mathematik', isMain: true, gross: [2], klein: [1, 2] },
          { id: 'subj-2', name: 'Deutsch', isMain: true, gross: [2], klein: [2] },
          { id: 'subj-3', name: 'Englisch', isMain: true, gross: [], klein: [1] },
          { id: 'subj-4', name: 'Physik', isMain: false, gross: [], klein: [2, 3] },
          { id: 'subj-5', name: 'Geschichte', isMain: false, gross: [], klein: [] }
        ]
      }
    ]
  };

  // --- App State ---
  let state = loadState();
  let currentSubjectId = null;
  let subjectPendingDeletion = null;

  // --- DOM Elements ---
  const el = {
    // Header & Year
    yearSelectorBtn: document.getElementById('yearSelectorBtn'),
    currentYearLabel: document.getElementById('currentYearLabel'),
    btnSettings: document.getElementById('btnSettings'),

    // Views
    viewDashboard: document.getElementById('viewDashboard'),
    viewDetail: document.getElementById('viewDetail'),

    // Dashboard
    overallAverageDisplay: document.getElementById('overallAverageDisplay'),
    summarySubjectCount: document.getElementById('summarySubjectCount'),
    summaryBadge: document.getElementById('summaryBadge'),
    summaryBadgeText: document.getElementById('summaryBadgeText'),
    subjectCountBadge: document.getElementById('subjectCountBadge'),
    subjectsList: document.getElementById('subjectsList'),
    emptySubjectsState: document.getElementById('emptySubjectsState'),
    btnOpenAddSubject: document.getElementById('btnOpenAddSubject'),
    btnEmptyAddSubject: document.getElementById('btnEmptyAddSubject'),

    // Detail View
    btnBackToDashboard: document.getElementById('btnBackToDashboard'),
    btnDeleteSubjectModal: document.getElementById('btnDeleteSubjectModal'),
    detailTypeBadge: document.getElementById('detailTypeBadge'),
    detailWeightingHint: document.getElementById('detailWeightingHint'),
    detailSubjectTitle: document.getElementById('detailSubjectTitle'),
    detailSubjectAverage: document.getElementById('detailSubjectAverage'),
    inputBoxGross: document.getElementById('inputBoxGross'),
    kleinGroupTitle: document.getElementById('kleinGroupTitle'),
    kleinGroupTag: document.getElementById('kleinGroupTag'),
    gradesBoxGross: document.getElementById('gradesBoxGross'),
    listGrossItems: document.getElementById('listGrossItems'),
    emptyGrossState: document.getElementById('emptyGrossState'),
    countGrossBadge: document.getElementById('countGrossBadge'),
    avgGrossBadge: document.getElementById('avgGrossBadge'),
    listKleinTitle: document.getElementById('listKleinTitle'),
    listKleinItems: document.getElementById('listKleinItems'),
    emptyKleinState: document.getElementById('emptyKleinState'),
    countKleinBadge: document.getElementById('countKleinBadge'),
    avgKleinBadge: document.getElementById('avgKleinBadge'),

    // Modals
    modalYears: document.getElementById('modalYears'),
    yearsRadioList: document.getElementById('yearsRadioList'),
    formNewYear: document.getElementById('formNewYear'),
    inputYearName: document.getElementById('inputYearName'),
    checkCopySubjects: document.getElementById('checkCopySubjects'),

    modalAddSubject: document.getElementById('modalAddSubject'),
    formAddSubject: document.getElementById('formAddSubject'),
    inputSubjectName: document.getElementById('inputSubjectName'),

    modalDeleteSubject: document.getElementById('modalDeleteSubject'),
    deleteSubjectNameTarget: document.getElementById('deleteSubjectNameTarget'),
    btnConfirmDeleteSubject: document.getElementById('btnConfirmDeleteSubject'),

    modalSettings: document.getElementById('modalSettings'),
    btnExportData: document.getElementById('btnExportData'),
    inputFileImport: document.getElementById('inputFileImport'),

    // Toast
    toast: document.getElementById('toast'),
    toastMessage: document.getElementById('toastMessage')
  };

  // --- Initialisierung ---
  function init() {
    initTheme();
    history.replaceState(null, '');
    setupEventListeners();
    renderApp();
  }

  // --- State Persistence ---
  function loadState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed.years) && parsed.years.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Fehler beim Laden aus localStorage:', e);
    }
    return JSON.parse(JSON.stringify(defaultInitialState));
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('Fehler beim Speichern in localStorage:', e);
      showToast('Fehler beim automatischen Speichern');
    }
  }

  // --- Hilfsfunktionen für Schuljahre & Fächer ---
  function getActiveYear() {
    let year = state.years.find(y => y.id === state.activeYearId);
    if (!year) {
      year = state.years[0];
      state.activeYearId = year ? year.id : null;
    }
    return year;
  }

  function getActiveSubject() {
    const year = getActiveYear();
    if (!year || !currentSubjectId) return null;
    return year.subjects.find(s => s.id === currentSubjectId) || null;
  }

  // --- Berechnungslogik (Exakt nach der Vorgabe) ---
  function calculateSubjectAverage(subject) {
    const gross = subject.gross || [];
    const klein = subject.klein || [];

    if (subject.isMain) {
      // Hauptfach: Schulaufgaben zählen 2-fach, Exen/mündlich 1-fach
      if (gross.length > 0 && klein.length > 0) {
        const avgGross = gross.reduce((a, b) => a + b, 0) / gross.length;
        const avgKlein = klein.reduce((a, b) => a + b, 0) / klein.length;
        return ((avgGross * 2) + avgKlein) / 3;
      } else if (gross.length > 0) {
        return gross.reduce((a, b) => a + b, 0) / gross.length;
      } else if (klein.length > 0) {
        return klein.reduce((a, b) => a + b, 0) / klein.length;
      }
      return null;
    } else {
      // Nebenfach: Nur kleine Noten
      if (klein.length > 0) {
        return klein.reduce((a, b) => a + b, 0) / klein.length;
      }
      return null;
    }
  }

  function calculateOverallAverage(year) {
    if (!year || !year.subjects || year.subjects.length === 0) {
      return { average: null, count: 0 };
    }

    const validAverages = [];
    year.subjects.forEach(subject => {
      const avg = calculateSubjectAverage(subject);
      if (avg !== null) {
        validAverages.push(avg);
      }
    });

    if (validAverages.length === 0) {
      return { average: null, count: 0 };
    }

    const sum = validAverages.reduce((a, b) => a + b, 0);
    return {
      average: sum / validAverages.length,
      count: validAverages.length
    };
  }

  // --- Formatierung & Farbkennzeichnung ---
  function formatGrade(val) {
    if (val === null || isNaN(val)) return '–.–';
    return Number(val).toFixed(2);
  }

  function getGradeColorClass(val) {
    if (val === null || isNaN(val)) return '';
    if (val <= 2.0) return 'good';
    if (val <= 3.8) return 'warning';
    return 'danger';
  }

  // --- Rendering ---
  function renderApp() {
    const year = getActiveYear();
    if (!year) return;

    // Header Schuljahr Label
    el.currentYearLabel.textContent = year.name;

    if (currentSubjectId) {
      renderDetailView();
    } else {
      renderDashboardView();
    }
  }

  // VIEW 1: Dashboard
  function renderDashboardView() {
    const cameFromDetail = el.viewDetail.classList.contains('active-view');
    document.body.classList.remove('detail-mode');
    el.viewDashboard.classList.toggle('from-detail', cameFromDetail);
    el.viewDashboard.classList.add('active-view');
    el.viewDetail.classList.remove('active-view');

    const year = getActiveYear();
    const subjects = year.subjects || [];

    // Gesamtstatistik
    const overall = calculateOverallAverage(year);
    el.overallAverageDisplay.textContent = formatGrade(overall.average);
    el.overallAverageDisplay.className = 'summary-score ' + getGradeColorClass(overall.average);

    const ratedCount = overall.count;
    el.summarySubjectCount.textContent = ratedCount === 1 
      ? '1 Fach bewertet' 
      : `${ratedCount} von ${subjects.length} Fächern bewertet`;

    // Status Badge
    if (overall.average !== null) {
      el.summaryBadge.classList.remove('hidden');
      if (overall.average <= 1.5) {
        el.summaryBadgeText.textContent = 'Hervorragend';
        el.summaryBadge.style.color = 'var(--accent-emerald)';
      } else if (overall.average <= 2.5) {
        el.summaryBadgeText.textContent = 'Gut';
        el.summaryBadge.style.color = 'var(--accent-emerald)';
      } else if (overall.average <= 3.5) {
        el.summaryBadgeText.textContent = 'Befriedigend';
        el.summaryBadge.style.color = 'var(--accent-amber)';
      } else if (overall.average <= 4.0) {
        el.summaryBadgeText.textContent = 'Ausreichend';
        el.summaryBadge.style.color = 'var(--accent-amber)';
      } else {
        el.summaryBadgeText.textContent = 'Gefährdet';
        el.summaryBadge.style.color = 'var(--accent-rose)';
      }
    } else {
      el.summaryBadge.classList.add('hidden');
    }

    // Fächer Counter
    el.subjectCountBadge.textContent = subjects.length;

    // Fächer Grid
    el.subjectsList.innerHTML = '';
    if (subjects.length === 0) {
      el.subjectsList.classList.add('hidden');
      el.emptySubjectsState.classList.remove('hidden');
    } else {
      el.emptySubjectsState.classList.add('hidden');
      el.subjectsList.classList.remove('hidden');

      // Sortieren: Fächer mit Noten zuerst (beste zuerst), danach unbewertete
      const sorted = [...subjects].sort((a, b) => {
        const avgA = calculateSubjectAverage(a);
        const avgB = calculateSubjectAverage(b);
        if (avgA === null && avgB === null) return a.name.localeCompare(b.name);
        if (avgA === null) return 1;
        if (avgB === null) return -1;
        return avgA - avgB;
      });

      sorted.forEach(subject => {
        const avg = calculateSubjectAverage(subject);
        const totalNotes = (subject.gross ? subject.gross.length : 0) + (subject.klein ? subject.klein.length : 0);

        const card = document.createElement('div');
        card.className = 'subject-card';
        card.onclick = () => openSubjectDetail(subject.id);

        card.innerHTML = `
          <div class="subject-card-top">
            <h3 class="subject-card-title">${escapeHtml(subject.name)}</h3>
            <span class="subject-type-tag ${subject.isMain ? 'hauptfach' : 'nebenfach'}">
              ${subject.isMain ? 'Hauptfach' : 'Nebenfach'}
            </span>
          </div>
          <div class="subject-card-bottom">
            <span class="subject-card-count">
              ${totalNotes === 1 ? '1 Note' : totalNotes + ' Noten'}
            </span>
            <span class="subject-card-average ${getGradeColorClass(avg)}">
              ${formatGrade(avg)}
            </span>
          </div>
        `;
        el.subjectsList.appendChild(card);
      });
    }
  }

  // VIEW 2: Detailansicht Fach
  function openSubjectDetail(subjectId) {
    currentSubjectId = subjectId;
    history.pushState({ view: 'detail' }, '');
    renderDetailView();
    window.scrollTo({ top: 0 });
  }

  // Zurück zur Übersicht (Knopf, Swipe, ESC)
  function goBack() {
    if (history.state && history.state.view === 'detail') {
      history.back(); // löst popstate aus
    } else {
      currentSubjectId = null;
      renderDashboardView();
    }
  }

  function renderDetailView() {
    const subject = getActiveSubject();
    if (!subject) {
      currentSubjectId = null;
      renderDashboardView();
      return;
    }

    document.body.classList.add('detail-mode');
    el.viewDashboard.classList.remove('active-view');
    el.viewDetail.classList.add('active-view');

    // Header Infos
    el.detailSubjectTitle.textContent = subject.name;
    const avg = calculateSubjectAverage(subject);
    el.detailSubjectAverage.textContent = formatGrade(avg);
    el.detailSubjectAverage.className = 'detail-score-val ' + getGradeColorClass(avg);

    if (subject.isMain) {
      el.detailTypeBadge.textContent = 'Hauptfach';
      el.detailTypeBadge.className = 'type-pill';
      el.detailWeightingHint.textContent = 'Gewichtung 2:1 (Schulaufgaben doppelt)';
      el.inputBoxGross.classList.remove('hidden');
      el.gradesBoxGross.classList.remove('hidden');
      el.kleinGroupTitle.textContent = 'Kleine Note hinzufügen';
      el.kleinGroupTag.textContent = 'Ex / Mündlich / Test • 1-fach';
      el.listKleinTitle.textContent = 'Kleine Noten';
    } else {
      el.detailTypeBadge.textContent = 'Nebenfach';
      el.detailTypeBadge.className = 'type-pill nebenfach';
      el.detailWeightingHint.textContent = 'Alle Noten einfach gewichtet';
      el.inputBoxGross.classList.add('hidden');
      el.gradesBoxGross.classList.add('hidden');
      el.kleinGroupTitle.textContent = 'Note hinzufügen';
      el.kleinGroupTag.textContent = 'Alle Leistungsnachweise • 1-fach';
      el.listKleinTitle.textContent = 'Noten';
    }

    // Liste Große Noten
    if (subject.isMain) {
      renderGradeList(
        subject.gross || [],
        el.listGrossItems,
        el.emptyGrossState,
        el.countGrossBadge,
        el.avgGrossBadge,
        'gross'
      );
    }

    // Liste Kleine Noten
    renderGradeList(
      subject.klein || [],
      el.listKleinItems,
      el.emptyKleinState,
      el.countKleinBadge,
      el.avgKleinBadge,
      'klein'
    );
  }

  function renderGradeList(notesList, containerEl, emptyEl, countBadgeEl, avgBadgeEl, type) {
    containerEl.innerHTML = '';
    countBadgeEl.textContent = notesList.length;

    if (notesList.length === 0) {
      emptyEl.classList.remove('hidden');
      avgBadgeEl.textContent = 'Ø –.–';
    } else {
      emptyEl.classList.add('hidden');
      const sum = notesList.reduce((a, b) => a + b, 0);
      const subAvg = sum / notesList.length;
      avgBadgeEl.textContent = `Ø ${formatGrade(subAvg)}`;

      notesList.forEach((grade, index) => {
        const chip = document.createElement('div');
        chip.className = `grade-chip ${type}`;
        chip.innerHTML = `
          <span class="grade-chip-val">${grade}</span>
          <button type="button" class="grade-chip-del" title="Note löschen" aria-label="Note löschen">
            <svg class="icon-svg-xs" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        `;

        chip.querySelector('.grade-chip-del').onclick = (e) => {
          e.stopPropagation();
          deleteGrade(type, index);
        };

        containerEl.appendChild(chip);
      });
    }
  }

  // --- Noten Hinzufügen / Löschen ---
  function addGrade(type, gradeVal) {
    const subject = getActiveSubject();
    if (!subject) return;

    if (type === 'gross') {
      if (!subject.gross) subject.gross = [];
      subject.gross.push(gradeVal);
    } else {
      if (!subject.klein) subject.klein = [];
      subject.klein.push(gradeVal);
    }

    saveState();
    renderDetailView();
    showToast(`Note ${gradeVal} eingetragen`);
  }

  function deleteGrade(type, index) {
    const subject = getActiveSubject();
    if (!subject) return;

    if (type === 'gross' && subject.gross) {
      subject.gross.splice(index, 1);
    } else if (type === 'klein' && subject.klein) {
      subject.klein.splice(index, 1);
    }

    saveState();
    renderDetailView();
    showToast('Note entfernt');
  }

  // --- Schuljahr Management ---
  function openYearsModal() {
    renderYearsList();
    openModal('modalYears');
    setTimeout(() => el.inputYearName.focus(), 150);
  }

  function renderYearsList() {
    el.yearsRadioList.innerHTML = '';
    state.years.forEach(year => {
      const isActive = year.id === state.activeYearId;
      const row = document.createElement('div');
      row.className = `year-item-row ${isActive ? 'active-year' : ''}`;
      
      const count = (year.subjects || []).length;
      row.innerHTML = `
        <div class="year-item-label">
          <input type="radio" name="yearSelectRadio" value="${year.id}" ${isActive ? 'checked' : ''}>
          <span>${escapeHtml(year.name)}</span>
          <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: normal;">(${count} ${count === 1 ? 'Fach' : 'Fächer'})</span>
        </div>
        ${state.years.length > 1 ? `
          <button type="button" class="year-del-btn" title="Schuljahr löschen">
            <svg class="icon-svg-xs" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 6h18"/>
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
            </svg>
          </button>
        ` : ''}
      `;

      // Wechseln bei Klick auf die Zeile
      row.onclick = (e) => {
        if (e.target.closest('.year-del-btn')) return;
        state.activeYearId = year.id;
        currentSubjectId = null;
        saveState();
        renderYearsList();
        renderApp();
        closeModal('modalYears');
        showToast(`Schuljahr gewechselt: ${year.name}`);
      };

      // Löschen-Button
      const delBtn = row.querySelector('.year-del-btn');
      if (delBtn) {
        delBtn.onclick = (e) => {
          e.stopPropagation();
          if (confirm(`Möchtest du das Schuljahr "${year.name}" mit allen Noten wirklich löschen?`)) {
            deleteSchoolYear(year.id);
          }
        };
      }

      el.yearsRadioList.appendChild(row);
    });
  }

  function createSchoolYear(name, copyExistingSubjects) {
    const cleanName = name.trim();
    if (!cleanName) return;

    // Prüfen auf Duplikate
    if (state.years.some(y => y.name.toLowerCase() === cleanName.toLowerCase())) {
      alert(`Ein Schuljahr mit dem Namen "${cleanName}" existiert bereits!`);
      return;
    }

    const currentYear = getActiveYear();
    let newSubjects = [];

    if (copyExistingSubjects && currentYear && currentYear.subjects) {
      // Fächer übernehmen, aber Noten komplett leeren
      newSubjects = currentYear.subjects.map(s => ({
        id: 'subj-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
        name: s.name,
        isMain: s.isMain,
        gross: [],
        klein: []
      }));
    }

    const newYearId = 'year-' + Date.now();
    const newYear = {
      id: newYearId,
      name: cleanName,
      subjects: newSubjects
    };

    state.years.push(newYear);
    state.activeYearId = newYearId;
    currentSubjectId = null;

    saveState();
    closeModal('modalYears');
    el.formNewYear.reset();
    el.checkCopySubjects.checked = true;
    renderApp();
    showToast(`Neues Schuljahr "${cleanName}" aktiviert!`);
  }

  function deleteSchoolYear(yearId) {
    if (state.years.length <= 1) {
      alert('Du musst mindestens ein Schuljahr behalten.');
      return;
    }

    state.years = state.years.filter(y => y.id !== yearId);
    if (state.activeYearId === yearId) {
      state.activeYearId = state.years[0].id;
    }
    currentSubjectId = null;
    saveState();
    renderYearsList();
    renderApp();
    showToast('Schuljahr gelöscht');
  }

  // --- Fächer Management ---
  function openAddSubjectModal() {
    el.formAddSubject.reset();
    openModal('modalAddSubject');
    setTimeout(() => el.inputSubjectName.focus(), 150);
  }

  function addSubject(name, isMain) {
    const cleanName = name.trim();
    if (!cleanName) return;

    const year = getActiveYear();
    if (!year) return;

    if (!year.subjects) year.subjects = [];

    // Duplikatprüfung innerhalb des aktuellen Schuljahrs
    const exists = year.subjects.some(s => s.name.toLowerCase() === cleanName.toLowerCase());
    if (exists) {
      alert(`Das Fach "${cleanName}" existiert in diesem Schuljahr bereits!`);
      return;
    }

    const newSubject = {
      id: 'subj-' + Date.now(),
      name: cleanName,
      isMain: isMain,
      gross: [],
      klein: []
    };

    year.subjects.push(newSubject);
    saveState();
    closeModal('modalAddSubject');
    renderApp();
    showToast(`Fach "${cleanName}" angelegt`);
  }

  function promptDeleteCurrentSubject() {
    const subject = getActiveSubject();
    if (!subject) return;

    subjectPendingDeletion = subject;
    el.deleteSubjectNameTarget.textContent = `"${subject.name}"`;
    openModal('modalDeleteSubject');
  }

  function confirmDeleteSubject() {
    if (!subjectPendingDeletion) return;
    const year = getActiveYear();
    if (year && year.subjects) {
      year.subjects = year.subjects.filter(s => s.id !== subjectPendingDeletion.id);
      saveState();
    }
    const name = subjectPendingDeletion.name;
    subjectPendingDeletion = null;
    closeModal('modalDeleteSubject');
    goBack();
    showToast(`Fach "${name}" gelöscht`);
  }

  // --- Modals Steuerung ---
  function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('hidden');
    }
  }

  function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('hidden');
    }
  }

  // Global window functions für Inline-Handler
  window.openAddSubjectModal = openAddSubjectModal;
  window.closeModal = closeModal;

  // --- Export & Import ---
  function exportData() {
    const jsonStr = JSON.stringify(state, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const dateStr = new Date().toISOString().slice(0, 10);
    const a = document.createElement('a');
    a.href = url;
    a.download = `notenrechner-backup-${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Backup-Datei gespeichert!');
  }

  function importData(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target.result);
        if (imported && Array.isArray(imported.years) && imported.years.length > 0) {
          state = imported;
          currentSubjectId = null;
          saveState();
          closeModal('modalSettings');
          renderApp();
          showToast('Daten erfolgreich wiederhergestellt!');
        } else {
          alert('Ungültiges Dateiformat. Die Datei enthält keine gültigen Noten-Daten.');
        }
      } catch (err) {
        console.error(err);
        alert('Fehler beim Lesen der Backup-Datei. Stelle sicher, dass es eine gültige JSON-Datei ist.');
      }
    };
    reader.readAsText(file);
  }

  // --- Toast Feedback ---
  let toastTimeout = null;
  function showToast(message) {
    if (toastTimeout) clearTimeout(toastTimeout);
    el.toastMessage.textContent = message;
    el.toast.classList.remove('hidden');
    toastTimeout = setTimeout(() => {
      el.toast.classList.add('hidden');
    }, 2400);
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // --- Event Listeners Setup ---
  function setupEventListeners() {
    // Schuljahr Modal
    el.yearSelectorBtn.addEventListener('click', openYearsModal);

    el.formNewYear.addEventListener('submit', (e) => {
      e.preventDefault();
      createSchoolYear(el.inputYearName.value, el.checkCopySubjects.checked);
    });

    // Fächer Modal
    el.btnOpenAddSubject.addEventListener('click', openAddSubjectModal);
    if (el.btnEmptyAddSubject) {
      el.btnEmptyAddSubject.addEventListener('click', openAddSubjectModal);
    }

    el.formAddSubject.addEventListener('submit', (e) => {
      e.preventDefault();
      const type = el.formAddSubject.querySelector('input[name="subjectType"]:checked').value;
      addSubject(el.inputSubjectName.value, type === 'hauptfach');
    });

    // Navigation Detailansicht
    el.btnBackToDashboard.addEventListener('click', goBack);

    // System-/Browser-Zurück (z. B. Android-Geste) -> Übersicht
    window.addEventListener('popstate', () => {
      currentSubjectId = null;
      renderDashboardView();
    });

    // Swipe nach rechts = zurück (nur in der Detailansicht, nicht bei offenem Fenster)
    let touchStartX = 0, touchStartY = 0, touchTracking = false;
    document.addEventListener('touchstart', (e) => {
      touchTracking = !!currentSubjectId && !document.querySelector('.modal-backdrop:not(.hidden)');
      if (!touchTracking) return;
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }, { passive: true });
    document.addEventListener('touchend', (e) => {
      if (!touchTracking) return;
      touchTracking = false;
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;
      if (dx > 70 && Math.abs(dy) < dx * 0.6) goBack();
    }, { passive: true });

    el.btnDeleteSubjectModal.addEventListener('click', promptDeleteCurrentSubject);
    el.btnConfirmDeleteSubject.addEventListener('click', confirmDeleteSubject);

    // Noten-Buttons Delegation
    document.querySelectorAll('.btn-grade-gross').forEach(btn => {
      btn.addEventListener('click', () => {
        const grade = parseInt(btn.getAttribute('data-grade'), 10);
        addGrade('gross', grade);
      });
    });

    document.querySelectorAll('.btn-grade-klein').forEach(btn => {
      btn.addEventListener('click', () => {
        const grade = parseInt(btn.getAttribute('data-grade'), 10);
        addGrade('klein', grade);
      });
    });

    // Modal Close Buttons (data-close)
    document.querySelectorAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', () => {
        const modalId = btn.getAttribute('data-close');
        closeModal(modalId);
      });
    });

    // Backdrop Click zum Schließen
    document.querySelectorAll('.modal-backdrop').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.classList.add('hidden');
        }
      });
    });

    // ESC-Taste schließt Modals & kehrt aus Detailansicht zurück
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const openModalEl = document.querySelector('.modal-backdrop:not(.hidden)');
        if (openModalEl) {
          openModalEl.classList.add('hidden');
        } else if (currentSubjectId) {
          goBack();
        }
      }
    });

    // Einstellungen & Backup
    el.btnSettings.addEventListener('click', () => openModal('modalSettings'));
    el.btnExportData.addEventListener('click', exportData);
    el.inputFileImport.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        importData(e.target.files[0]);
        e.target.value = ''; // Reset file input
      }
    });
  }

  // --- Farbthemen ---
  const THEME_KEY = 'notenrechner_theme';
  const THEMES = [
    { id: 'blau',    name: 'Blau',    colors: ['#3b82f6', '#10b981'], bar: '#080c14' },
    { id: 'violett', name: 'Violett', colors: ['#8b5cf6', '#ec4899'], bar: '#0b0912' },
    { id: 'graphit', name: 'Graphit', colors: ['#38bdf8', '#818cf8'], bar: '#0a0a0c' },
    { id: 'teal',    name: 'Teal',    colors: ['#2dd4bf', '#0ea5e9'], bar: '#061110' },
    { id: 'gold',    name: 'Gold',    colors: ['#d6a461', '#c2410c'], bar: '#0e0c0a' }
  ];

  function applyTheme(id) {
    const theme = THEMES.find(t => t.id === id) || THEMES[0];
    if (theme.id === 'blau') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', theme.id);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme.bar);
    try { localStorage.setItem(THEME_KEY, theme.id); } catch (e) {}
    renderThemePicker(theme.id);
  }

  function renderThemePicker(activeId) {
    const box = document.getElementById('themePicker');
    if (!box) return;
    box.innerHTML = '';
    THEMES.forEach(t => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'theme-swatch' + (t.id === activeId ? ' selected' : '');
      b.innerHTML = `<span class="theme-dots"><span style="background:${t.colors[0]}"></span><span style="background:${t.colors[1]}"></span></span>${t.name}`;
      b.onclick = () => applyTheme(t.id);
      box.appendChild(b);
    });
  }

  function initTheme() {
    let saved = null;
    try { saved = localStorage.getItem(THEME_KEY); } catch (e) {}
    applyTheme(saved || 'blau');
  }

  // Service Worker (macht die Seite als App installierbar / offlinefähig)
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }

  // --- Start ---
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
