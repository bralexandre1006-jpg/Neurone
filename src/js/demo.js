export const DEMO_DOMAINS = [
  {
    id: 'demo-anglais',
    demo: true,
    name: 'Anglais',
    description: 'Aperçu de démonstration : deux modules pour tester le parcours (leçons, quiz, examen final).',
    color: '#60a5fa',
    icon: 'globe',
    level: 'Débutant',
    durationWeeks: 12,
    goal: 'Tenir une conversation simple et comprendre un texte courant.',
    createdAt: Date.now(),
    modules: [
      {
        id: 'm1',
        title: 'Les bases : être et avoir',
        summary: 'Les deux verbes indispensables au présent.',
        week: 1,
        lessons: [
          {
            id: 'm1l1', title: 'Le verbe « to be »', minutes: 12,
            content: `<p>« To be » signifie <strong>être</strong>. C'est le verbe le plus utilisé de la langue anglaise.</p>
<h2>Conjugaison au présent</h2>
<table><tr><th>Sujet</th><th>Forme pleine</th><th>Contraction</th></tr>
<tr><td>I</td><td>am</td><td>I'm</td></tr>
<tr><td>You</td><td>are</td><td>you're</td></tr>
<tr><td>He / She / It</td><td>is</td><td>he's / she's / it's</td></tr>
<tr><td>We / They</td><td>are</td><td>we're / they're</td></tr></table>
<div class="note">À l'oral, on utilise presque toujours la contraction : <code>I'm tired</code> plutôt que <code>I am tired</code>.</div>
<h2>Négation</h2>
<p>On ajoute <strong>not</strong> après le verbe : <code>She is not (isn't) here.</code></p>`
          },
          {
            id: 'm1l2', title: 'Le verbe « to have »', minutes: 10,
            content: `<p>« To have » signifie <strong>avoir</strong>.</p>
<ul><li>I / You / We / They <strong>have</strong></li><li>He / She / It <strong>has</strong></li></ul>
<p>Exemple : <code>She has two brothers.</code> — Elle a deux frères.</p>
<div class="note">Attention : on dit <code>I am 20 years old</code> (être) et non « I have 20 years ».</div>`
          }
        ],
        quiz: {
          passScore: 70,
          questions: [
            { q: 'Complète : « She ___ a teacher. »', choices: ['am', 'is', 'are', 'has'], answer: 1, explain: 'He / She / It → is.' },
            { q: 'Traduis « J\'ai 25 ans ».', choices: ['I have 25 years.', 'I am 25 years old.', 'I has 25 years.', 'I\'m have 25.'], answer: 1, explain: 'L\'âge se dit avec « to be ».' },
            { q: 'Complète : « They ___ a big house. »', choices: ['has', 'is', 'have', 'are'], answer: 2, explain: 'They → have.' }
          ]
        }
      },
      {
        id: 'm2',
        title: 'Le présent simple',
        summary: 'Habitudes, vérités générales et le fameux « -s » à la 3e personne.',
        week: 2,
        lessons: [
          {
            id: 'm2l1', title: 'Formation et emploi', minutes: 14,
            content: `<p>Le présent simple exprime une <strong>habitude</strong> ou une <strong>vérité générale</strong>.</p>
<h2>Formation</h2>
<p>Base verbale, avec un <strong>-s</strong> à la 3e personne du singulier : <code>I work</code>, <code>he works</code>.</p>
<h2>Négation et question</h2>
<p>On utilise l'auxiliaire <strong>do / does</strong> : <code>She doesn't work.</code> — <code>Do you work?</code></p>`
          },
          {
            id: 'm2l2', title: 'Les adverbes de fréquence', minutes: 8,
            content: `<p>Ils se placent <strong>avant le verbe</strong> (mais après « to be ») :</p>
<ul><li>always — toujours</li><li>usually — d'habitude</li><li>often — souvent</li><li>sometimes — parfois</li><li>never — jamais</li></ul>
<p><code>I often drink tea.</code> — <code>He is always late.</code></p>`
          }
        ],
        quiz: {
          passScore: 70,
          questions: [
            { q: 'Complète : « He ___ in London. »', choices: ['live', 'lives', 'living', 'is live'], answer: 1, explain: '3e personne du singulier → -s.' },
            { q: 'Forme négative de « She plays tennis » :', choices: ['She don\'t play tennis.', 'She doesn\'t plays tennis.', 'She doesn\'t play tennis.', 'She not play tennis.'], answer: 2, explain: 'Avec doesn\'t, le verbe reste à la base.' },
            { q: 'Où placer « never » ? « I ___ eat ___ meat. »', choices: ['avant eat', 'après meat', 'en début de phrase', 'après eat'], answer: 0, explain: 'Avant le verbe principal.' }
          ]
        }
      }
    ],
    exam: {
      passScore: 75,
      questions: [
        { q: '« We ___ hungry. »', choices: ['is', 'am', 'are', 'be'], answer: 2 },
        { q: '« My sister ___ a cat. »', choices: ['have', 'has', 'is', 'haves'], answer: 1 },
        { q: '« ___ you speak English? »', choices: ['Does', 'Are', 'Do', 'Is'], answer: 2 },
        { q: '« He ___ coffee in the morning. » (habitude)', choices: ['drink', 'drinks', 'is drink', 'drinking'], answer: 1 }
      ]
    }
  },
  {
    id: 'demo-communisme',
    demo: true,
    name: 'Histoire du communisme',
    description: 'Aperçu de démonstration : des idées de Marx aux révolutions du XXe siècle.',
    color: '#f87171',
    icon: 'hammer',
    level: 'Intermédiaire',
    durationWeeks: 8,
    goal: 'Comprendre les fondements théoriques et les grandes étapes historiques.',
    createdAt: Date.now(),
    modules: [
      {
        id: 'm1',
        title: 'Les origines théoriques',
        summary: 'Marx, Engels et le Manifeste de 1848.',
        week: 1,
        lessons: [
          {
            id: 'm1l1', title: 'Le Manifeste du Parti communiste', minutes: 15,
            content: `<p>Publié en <strong>février 1848</strong> par Karl Marx et Friedrich Engels, le Manifeste s'ouvre sur une phrase célèbre : « Un spectre hante l'Europe : le spectre du communisme. »</p>
<h2>Idées clés</h2>
<ul><li>L'histoire est celle de la <strong>lutte des classes</strong>.</li><li>La bourgeoisie a révolutionné la production mais crée son propre fossoyeur : le prolétariat.</li><li>Objectif : l'abolition de la propriété privée des moyens de production.</li></ul>
<blockquote>« Prolétaires de tous les pays, unissez-vous ! »</blockquote>`
          }
        ],
        quiz: {
          passScore: 70,
          questions: [
            { q: 'En quelle année paraît le Manifeste du Parti communiste ?', choices: ['1789', '1848', '1871', '1917'], answer: 1, explain: 'Février 1848, juste avant le « printemps des peuples ».' },
            { q: 'Qui co-écrit le Manifeste avec Marx ?', choices: ['Lénine', 'Proudhon', 'Engels', 'Bakounine'], answer: 2 }
          ]
        }
      }
    ],
    exam: null
  }
];
