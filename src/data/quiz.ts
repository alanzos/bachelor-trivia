import { allPlayers } from './teams'
import type { MultipleChoiceQuestion, PersonalFactEntry, PersonalFactQuestion, QuizRound } from '../lib/types'

const round1Questions: MultipleChoiceQuestion[] = [
  { id: 'r1-q1', type: 'multiple-choice', question: 'Which of these cities has the largest population within city limits?', options: ['Athens', 'Madrid', 'Rome', 'Lisbon'], correctOptionIndex: 1, explanation: 'Madrid has the largest population within city limits among these options.' },
  { id: 'r1-q2', type: 'multiple-choice', question: 'Bern\'s Zytglogge is one of the city\'s landmarks. What was it originally built as?', options: ['A prison tower', 'A city gate', 'A church bell tower', 'A tax office'], correctOptionIndex: 1, explanation: 'The Zytglogge began as a city gate before later uses and rebuilds.' },
  { id: 'r1-q3', type: 'multiple-choice', question: 'The Acropolis is in Athens. What does the word “Acropolis” roughly mean?', options: ['Sacred mountain', 'High city', 'Old temple', 'Stone fortress'], correctOptionIndex: 1, explanation: 'Acropolis literally means “high city”.' },
  { id: 'r1-q4', type: 'multiple-choice', question: 'Naples is close to Mount Vesuvius. In which year did the famous eruption destroy Pompeii and Herculaneum?', options: ['44 BC', 'AD 79', 'AD 410', 'AD 1066'], correctOptionIndex: 1, explanation: 'The eruption happened in AD 79.' },
  { id: 'r1-q5', type: 'multiple-choice', question: 'Angel Falls, in Venezuela, is often described as the world’s tallest uninterrupted waterfall. What is its approximate height?', options: ['379 m', '579 m', '779 m', '979 m'], correctOptionIndex: 3, explanation: 'Angel Falls is about 979 metres high.' },
  { id: 'r1-q6', type: 'multiple-choice', question: 'Which of these islands is the largest by area?', options: ['Mallorca', 'Sicily', 'Madeira', 'Ibiza'], correctOptionIndex: 1, explanation: 'Sicily is the largest island in the list.' },
  { id: 'r1-q7', type: 'multiple-choice', question: 'Galicia has its own co-official language, Galician. Which language is it most closely related to?', options: ['Basque', 'Portuguese', 'Catalan', 'Italian'], correctOptionIndex: 1, explanation: 'Galician is very closely related to Portuguese.' },
  { id: 'r1-q8', type: 'multiple-choice', question: 'Which of these countries has the longest land border with Germany?', options: ['Switzerland', 'France', 'Austria', 'Poland'], correctOptionIndex: 2, explanation: 'Austria has the longest border among these options.' },
  { id: 'r1-q9', type: 'multiple-choice', question: 'Which of these cities is closest to Erlach in a straight line?', options: ['Athens', 'Lisbon', 'Rome', 'Barcelona'], correctOptionIndex: 2, explanation: 'Rome is closest among the four options.' },
  { id: 'r1-q10', type: 'multiple-choice', question: 'The first modern Olympic Games were held in Athens in 1896. What did winners receive at those Games?', options: ['Gold medals', 'Silver medals', 'Bronze medals', 'Laurel wreaths only'], correctOptionIndex: 1, explanation: 'Winners received silver medals at the 1896 Olympics.' },
  { id: 'r1-q11', type: 'multiple-choice', question: 'Lisbon was hit by a major earthquake in 1755. On which religious date did it happen?', options: ['Easter Sunday', 'Christmas Day', 'All Saints\' Day', 'Ash Wednesday'], correctOptionIndex: 2, explanation: 'The earthquake struck on All Saints\' Day.' },
  { id: 'r1-q12', type: 'multiple-choice', question: 'Mount Etna is located in Sicily. Which of these statements about it is correct?', options: ['It is the highest active volcano in Europe', 'The fastest registered sea-to-summit time is under 3 hours', 'It last erupted only in ancient Roman times', 'It is smaller than Vesuvius'], correctOptionIndex: 0, explanation: 'Mount Etna is Europe\'s highest active volcano.' },
]

const round2Questions: MultipleChoiceQuestion[] = [
  { id: 'r2-q1', type: 'multiple-choice', question: 'Which country is most associated with paella?', options: ['Spain', 'Greece', 'Portugal', 'Switzerland'], correctOptionIndex: 0 },
  { id: 'r2-q2', type: 'multiple-choice', question: 'Which city is associated with Neapolitan pizza?', options: ['Rome', 'Naples', 'Milan', 'Palermo'], correctOptionIndex: 1 },
  { id: 'r2-q3', type: 'multiple-choice', question: 'What is usually the main ingredient in gazpacho?', options: ['Potato', 'Tomato', 'Chickpeas', 'Aubergine'], correctOptionIndex: 1 },
  { id: 'r2-q4', type: 'multiple-choice', question: 'Which country is famous for bacalhau dishes?', options: ['Portugal', 'Germany', 'Greece', 'Venezuela'], correctOptionIndex: 0 },
  { id: 'r2-q5', type: 'multiple-choice', question: 'What are the two key ingredients usually associated with tzatziki?', options: ['Tomato and basil', 'Yoghurt and cucumber', 'Potato and cheese', 'Chickpeas and tahini'], correctOptionIndex: 1 },
  { id: 'r2-q6', type: 'multiple-choice', question: 'Which country is strongly associated with risotto?', options: ['Italy', 'Spain', 'Portugal', 'Greece'], correctOptionIndex: 0 },
  { id: 'r2-q7', type: 'multiple-choice', question: 'What is the typical shape of a pastel de nata?', options: ['Long rectangle', 'Small round tart', 'Triangle', 'Flat square'], correctOptionIndex: 1 },
  { id: 'r2-q8', type: 'multiple-choice', question: 'Which country is famous for fondue?', options: ['Switzerland', 'Venezuela', 'Spain', 'Portugal'], correctOptionIndex: 0 },
  { id: 'r2-q9', type: 'multiple-choice', question: 'Which of these is not Italian?', options: ['Focaccia', 'Souvlaki', 'Arancini', 'Risotto'], correctOptionIndex: 1 },
  { id: 'r2-q10', type: 'multiple-choice', question: 'Which herb is commonly used in pesto?', options: ['Basil', 'Mint', 'Coriander', 'Rosemary'], correctOptionIndex: 0 },
  { id: 'r2-q11', type: 'multiple-choice', question: 'Which vegetable grows underground?', options: ['Tomato', 'Potato', 'Aubergine', 'Pepper'], correctOptionIndex: 1 },
  { id: 'r2-q12', type: 'multiple-choice', question: 'Which herb is often used with tomato and mozzarella?', options: ['Basil', 'Dill', 'Parsley', 'Thyme'], correctOptionIndex: 0 },
  { id: 'r2-q13', type: 'multiple-choice', question: 'Which fruit grows on vines?', options: ['Apple', 'Grape', 'Orange', 'Pear'], correctOptionIndex: 1 },
  { id: 'r2-q14', type: 'multiple-choice', question: 'Which plant is used to make olive oil?', options: ['Olive tree', 'Lemon tree', 'Fig tree', 'Almond tree'], correctOptionIndex: 0 },
  { id: 'r2-q15', type: 'multiple-choice', question: 'Which ingredient is usually the base of hummus?', options: ['Lentils', 'Chickpeas', 'Beans', 'Rice'], correctOptionIndex: 1 },
]

const fallbackGroupQuestions: MultipleChoiceQuestion[] = [
  { id: 'r3-q1', type: 'multiple-choice', question: 'Which couple includes one person from Germany and one from Catalonia?', options: ['Sofia and Panagiotis', 'Juna and Flo', 'Roberta and Hadrien', 'Núria and Carlos'], correctOptionIndex: 1 },
  { id: 'r3-q2', type: 'multiple-choice', question: 'Which couple includes two people connected to Athens?', options: ['Sofia and Panagiotis', 'David and Rita', 'Taisia and Corrado', 'Lia and Andres'], correctOptionIndex: 0 },
  { id: 'r3-q3', type: 'multiple-choice', question: 'Which couple includes Portugal / Lisbon area?', options: ['David and Rita', 'Núria and Carlos', 'Juna and Flo', 'Roberta and Hadrien'], correctOptionIndex: 0 },
  { id: 'r3-q4', type: 'multiple-choice', question: 'Which couple includes Rome and Corrado?', options: ['Taisia and Corrado', 'Lia and Andres', 'Sofia and Panagiotis', 'Núria and Carlos'], correctOptionIndex: 0 },
  { id: 'r3-q5', type: 'multiple-choice', question: 'Which couple includes Sicily and Caracas / Vigo?', options: ['Roberta and Hadrien', 'Lia and Andres', 'Juna and Flo', 'David and Rita'], correctOptionIndex: 1 },
  { id: 'r3-q6', type: 'multiple-choice', question: 'Which couple includes Mallorca and Barcelona?', options: ['Núria and Carlos', 'Taisia and Corrado', 'Sofia and Panagiotis', 'David and Rita'], correctOptionIndex: 0 },
  { id: 'r3-q7', type: 'multiple-choice', question: 'Which couple includes Naples and Switzerland / USA?', options: ['Lia and Andres', 'Roberta and Hadrien', 'Juna and Flo', 'David and Rita'], correctOptionIndex: 1 },
  { id: 'r3-q8', type: 'multiple-choice', question: 'Who is attending without a partner in the list?', options: ['Rodrigo', 'Carlos', 'Flo', 'David'], correctOptionIndex: 0 },
  { id: 'r3-q9', type: 'multiple-choice', question: 'How many couples are listed?', options: ['5', '6', '7', '8'], correctOptionIndex: 2 },
  { id: 'r3-q10', type: 'multiple-choice', question: 'How many people are listed if everyone goes?', options: ['12', '13', '14', '15'], correctOptionIndex: 3 },
]

const round4Questions: MultipleChoiceQuestion[] = [
  {
    id: 'r4-q1',
    type: 'multiple-choice',
    question: 'What is the approximate height of the tallest man ever recorded, Robert Wadlow?',
    options: ['2.32 m', '2.52 m', '2.72 m', '2.92 m'],
    correctOptionIndex: 2,
  },
  {
    id: 'r4-q2',
    type: 'multiple-choice',
    question: 'What is the longest recorded human fingernail length on a pair of hands, combined?',
    options: ['Around 3.5 m', 'Around 5.8 m', 'Around 8.7 m', 'Around 13.1 m'],
    correctOptionIndex: 2,
  },
  {
    id: 'r4-q3',
    type: 'multiple-choice',
    question: 'What is the fastest recorded speed of a cheetah over a short distance?',
    options: ['Around 75 km/h', 'Around 98 km/h', 'Around 120 km/h', 'Around 150 km/h'],
    correctOptionIndex: 1,
  },
  {
    id: 'r4-q4',
    type: 'multiple-choice',
    question: 'Which food holds the Guinness World Record for the most expensive commercially available pizza?',
    options: [
      'Pizza with caviar and lobster',
      'Pizza with gold leaf, truffles, and rare cheeses',
      'Pizza with wagyu beef and champagne sauce',
      'Pizza with white truffle only',
    ],
    correctOptionIndex: 1,
  },
  {
    id: 'r4-q5',
    type: 'multiple-choice',
    question: 'What is the approximate record for the longest time spent holding one’s breath voluntarily, using oxygen beforehand?',
    options: ['Around 8 minutes', 'Around 14 minutes', 'Around 24 minutes', 'Around 34 minutes'],
    correctOptionIndex: 2,
  },
  {
    id: 'r4-q6',
    type: 'multiple-choice',
    question: 'Which animal has the largest eyes of any living animal?',
    options: ['Blue whale', 'Giant squid', 'Elephant', 'Ostrich'],
    correctOptionIndex: 1,
  },
  {
    id: 'r4-q7',
    type: 'multiple-choice',
    question: 'What is the approximate length of the longest wedding veil ever recorded?',
    options: ['1.2 km', '3.9 km', '6.9 km', '10.5 km'],
    correctOptionIndex: 2,
  },
  {
    id: 'r4-q8',
    type: 'multiple-choice',
    question: 'What is the largest pizza ever made, approximately by area?',
    options: ['126 m²', '320 m²', '780 m²', '1,296 m²'],
    correctOptionIndex: 3,
  },
  {
    id: 'r4-q9',
    type: 'multiple-choice',
    question: 'What is the record for the most people dressed as smurfs in one place?',
    options: ['Around 700', 'Around 1,200', 'Around 2,700', 'Around 5,000'],
    correctOptionIndex: 2,
  },
  {
    id: 'r4-q10',
    type: 'multiple-choice',
    question: 'What is the highest number of hot dogs eaten in 10 minutes in a recognized competitive eating contest?',
    options: ['52', '76', '91', '103'],
    correctOptionIndex: 1,
  },
]

export const buildPersonalFactQuestions = (entries: PersonalFactEntry[]): PersonalFactQuestion[] => {
  return entries.map((entry, index) => {
    const distractors = allPlayers.filter((name) => name !== entry.correctPerson).slice(0, 3)
    return {
      id: `r3-custom-${index + 1}`,
      type: 'personal',
      question: `Who is this fact about? ${entry.factText}`,
      options: [entry.correctPerson, ...distractors],
      correctOptionIndex: 0,
      factText: entry.factText,
      category: entry.category,
      difficulty: entry.difficulty,
      explanation: `${entry.correctPerson}: ${entry.factText}`,
    }
  })
}

export const buildQuizRounds = (entries: PersonalFactEntry[]): QuizRound[] => {
  const round3Questions = entries.length > 0 ? buildPersonalFactQuestions(entries) : fallbackGroupQuestions

  return [
    { id: 'round-1', title: 'Countries and cities', description: 'Multiple choice questions about cities, borders, geography, and famous landmarks.', type: 'multiple-choice', pointsPerQuestion: 1, questions: round1Questions },
    { id: 'round-2', title: 'Food, cooking, and gardening', description: 'Relaxed multiple choice questions about food, ingredients, and plants.', type: 'multiple-choice', pointsPerQuestion: 1, questions: round2Questions },
    { id: 'round-3', title: entries.length > 0 ? 'Personal facts' : 'Personal and group trivia', description: entries.length > 0 ? 'Custom facts entered by the host. Teams guess which person each fact belongs to.' : 'Fallback group trivia about couples, combinations, and who is attending.', type: 'personal', pointsPerQuestion: 1, questions: round3Questions },
    { id: 'round-4', title: 'Weird World Records & Strange Facts', description: 'Four-option questions with one correct answer. No phones.', type: 'multiple-choice', pointsPerQuestion: 1, questions: round4Questions },
  ]
}
