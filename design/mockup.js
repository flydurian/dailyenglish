(() => {
  const all = (selector, root = document) => [...root.querySelectorAll(selector)];

  // 상단 탭 전환
  all('[data-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      all('[data-tab]').forEach((item) => {
        const active = item === button;
        item.classList.toggle('active', active);
        item.setAttribute('aria-selected', String(active));
      });
      all('[data-view]').forEach((view) => {
        view.hidden = view.dataset.view !== button.dataset.tab;
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });

  // 레벨 선택
  all('[data-level]').forEach((button) => {
    button.addEventListener('click', () => {
      all('[data-level]').forEach((item) => {
        const active = item === button;
        item.classList.toggle('active', active);
        item.setAttribute('aria-pressed', String(active));
      });
      all('[data-level-label]').forEach((label) => {
        label.textContent = button.dataset.level;
      });
    });
  });

  // 번역 토글
  all('[data-translate]').forEach((button) => {
    button.addEventListener('click', () => {
      const card = button.closest('[data-card]');
      const translation = card && card.querySelector('[data-translation]');
      if (!translation) return;
      const willOpen = translation.hidden;
      translation.hidden = !willOpen;
      button.classList.toggle('on', willOpen);
      button.setAttribute('aria-expanded', String(willOpen));
    });
  });

  // 상세 정보 토글
  all('[data-details-toggle]').forEach((button) => {
    button.addEventListener('click', () => {
      const card = button.closest('[data-card]');
      const details = card && card.querySelector('[data-details]');
      if (!details) return;
      const willOpen = details.hidden;
      details.hidden = !willOpen;
      button.classList.toggle('on', willOpen);
      button.setAttribute('aria-expanded', String(willOpen));
    });
  });

  // 글자 크기 3단계
  const steps = [1, 1.08, 1.16];
  let index = 0;
  all('[data-font]').forEach((button) => {
    button.addEventListener('click', () => {
      index = (index + 1) % steps.length;
      document.documentElement.style.setProperty('--font-scale', String(steps[index]));
      all('[data-font-label]').forEach((label) => {
        label.textContent = `${Math.round(steps[index] * 100)}%`;
      });
      button.classList.toggle('scaled', index !== 0);
    });
  });
})();
