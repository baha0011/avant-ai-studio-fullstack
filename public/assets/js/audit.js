(function () {
  const quiz = document.querySelector('.solution-quiz');
  const resultCard = document.querySelector('.quiz-result-card');
  if (!quiz || !resultCard) return;

  let report = resultCard.querySelector('.ai-audit-report');
  if (!report) {
    report = document.createElement('div');
    report.className = 'ai-audit-report';
    report.innerHTML = `
      <div class="section-label">AI Audit Report</div>
      <h3 id="auditTitle">Очікуємо відповіді квизу</h3>
      <p id="auditText" class="muted">Після вибору відповідей тут зʼявиться короткий аудит і рекомендований MVP.</p>
      <div class="audit-tags" id="auditTags"></div>
    `;
    resultCard.appendChild(report);
  }

  const auditTitle = document.getElementById('auditTitle');
  const auditText = document.getElementById('auditText');
  const auditTags = document.getElementById('auditTags');

  const answers = {};

  const recommendations = {
    start: {
      title: 'START: швидко прибрати втрати заявок',
      text: 'Рекомендований MVP: форма заявки, Telegram-сповіщення, Google Sheets і базовий контроль статусів.',
      tags: ['Lead Capture', 'Telegram', 'Google Sheets', 'MVP']
    },
    assistant: {
      title: 'ASSISTANT: автоматизувати типові діалоги',
      text: 'Рекомендований MVP: ШІ-асистент із сценаріями відповідей, кваліфікацією клієнта і передачею заявки менеджеру.',
      tags: ['AI Assistant', 'FAQ-сценарії', 'Кваліфікація', 'Telegram']
    },
    system: {
      title: 'SYSTEM: побудувати повну систему заявок',
      text: 'Рекомендований MVP: база Supabase, admin-панель, статуси, Telegram-кнопки, Sheets/CRM і звітність.',
      tags: ['Supabase', 'Admin CRM', 'Status Flow', 'Automation']
    }
  };

  function render() {
    const values = Object.values(answers);
    if (!values.length) return;

    const score = values.reduce((acc, item) => {
      acc[item] = (acc[item] || 0) + 1;
      return acc;
    }, { start: 0, assistant: 0, system: 0 });

    const winner = Object.entries(score).sort((a, b) => b[1] - a[1])[0][0];
    const rec = recommendations[winner];

    auditTitle.textContent = rec.title;
    auditText.textContent = rec.text;
    auditTags.innerHTML = rec.tags.map((tag) => `<span>${tag}</span>`).join('');

    const summary = `${rec.title}. ${rec.text}`;
    localStorage.setItem('avantQuizResult', summary);
    localStorage.setItem('avantAuditReport', summary);
  }

  quiz.querySelectorAll('[data-score]').forEach((button) => {
    button.addEventListener('click', () => {
      const question = button.closest('.quiz-question');
      const index = Array.from(quiz.querySelectorAll('.quiz-question')).indexOf(question);
      answers[index] = button.dataset.score;
      render();
    });
  });
})();
