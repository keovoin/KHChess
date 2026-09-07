export type Locale = 'en' | 'kh'

// Flat key -> string dictionary per locale.
export const en: Record<string, string> = {
  // Landing
  'landing.welcome': 'Welcome to ChessArena.ai powered by Motia!',
  'landing.tagline':
    'ChessArena.ai was created to show how leading models compete against each other in chess games.',
  'landing.learnMore': 'Click here to learn more.',
  'landing.openSource': 'This project is open-source, click',
  'landing.here': 'here',
  'landing.openSourceTail': 'to read more about the project.',
  'landing.createGame': 'Create Game',
  'landing.liveMatches': 'View Live Matches',
  'landing.leaderboard': 'Leaderboard',

  // Auth
  'auth.signIn': 'Sign In',
  'auth.noAccount': 'No account? Play as a guest',
  'auth.noAccountShort': 'No account?',
  'auth.noAccountTail': 'Play as a guest',
  'auth.logIn': 'Log in',
  'auth.playAsGuest': 'Play as Guest',
  'auth.guest': 'Guest',
  'auth.signOut': 'Sign Out',
  'auth.admin': 'Admin',
  'auth.guestBadge': 'guest',

  // Login
  'login.title': 'Login',
  'login.google': 'Continue with Google',
  'login.or': 'Or',
  'login.emailPlaceholder': 'Enter your email',
  'login.continue': 'Continue',
  'login.verify': 'Verify',
  'login.footnote':
    'If no accounts are found under this email, we\u2019ll create an account for you. By creating an account you agree with the',
  'login.privacy': 'Privacy Policy',

  // Create game
  'create.title': 'Create Game',
  'create.opponent': 'Who do you want to play?',
  'create.friendInvite': 'Challenge a friend',
  'create.friendInviteDesc': 'You play White — share the invite link',
  'create.ai': 'Play against AI',
  'create.aiDesc': 'Pick a model and take on the computer',
  'create.selectColor': 'Select your color',
  'create.white': 'White',
  'create.black': 'Black',
  'create.player': 'Player',
  'create.model': 'Model',
  'create.playerDesc': 'Who you will be in this game',
  'create.modelDesc': 'Which AI model will play your opponent',
  'create.create': 'Create Game',
  'create.aiRequired': 'An AI model is required',
  'create.aiRequiredDesc': 'You must select an AI model to continue',

  // Invite / PvP
  'invite.title': 'Invite a friend',
  'invite.desc': 'Send them the link — they take the black seat',
  'invite.copy': 'Copy link',
  'invite.share': 'Share',
  'invite.shareText': 'I challenged you to a chess game on ChessArena!',
  'invite.copied': 'Link copied!',
  'invite.waiting': 'Waiting for opponent to join…',
  'game.wins': 'wins!',
  'game.draw': 'Draw!',

  // Game
  'game.gameplay': 'Gameplay',
  'game.sidechat': 'Sidechat',
  'game.sidechatDesc': 'Chat with other spectators',

  // Admin
  'admin.title': 'Admin Panel',
  'admin.users': 'Total Users',
  'admin.guests': 'Guests',
  'admin.games': 'Total Games',
  'admin.liveAi': 'Live AI Games',
  'admin.recentGames': 'Recent Games',
  'admin.noGames': 'No games yet.',

  // General
  'common.back': 'Back',
  'common.loading': 'Loading…',
}

export const kh: Record<string, string> = {
  // Landing
  'landing.welcome': 'សូមស្វាគមន៍មកកាន់ ChessArena.ai ដោយ Motia!',
  'landing.tagline':
    'ChessArena.ai ត្រូវបានបង្កើតឡើង ដើម្បីបង្ហាញពីរបៀបដែលម៉ូឌែល AI ដ៏ល្បីល្បាញ ប្រកួតប្រជែងគ្នាក្នុងការលេងស៊ែស។',
  'landing.learnMore': 'ចុចនៅទីនេះដើម្បីស្វែងយល់បន្ថែម។',
  'landing.openSource': 'គម្រោងនេះជា open-source ចុច',
  'landing.here': 'នៅទីនេះ',
  'landing.openSourceTail': 'ដើម្បីអានបន្ថែមអំពីគម្រោង។',
  'landing.createGame': 'បង្កើតការលេង',
  'landing.liveMatches': 'មើលការប្រកួតផ្ទាល់',
  'landing.leaderboard': 'តារាងពិន្ទុ',

  // Auth
  'auth.signIn': 'ចូលគណនី',
  'auth.noAccount': 'គ្មានគណនី? លេងជាភ្ញៀវ',
  'auth.noAccountShort': 'គ្មានគណនី?',
  'auth.noAccountTail': 'លេងជាភ្ញៀវ',
  'auth.logIn': 'ចូល',
  'auth.playAsGuest': 'លេងជាភ្ញៀវ',
  'auth.guest': 'ភ្ញៀវ',
  'auth.signOut': 'ចាកចេញ',
  'auth.admin': 'អ្នកគ្រប់គ្រង',
  'auth.guestBadge': 'ភ្ញៀវ',

  // Login
  'login.title': 'ចូលគណនី',
  'login.google': 'បន្តជាមួយ Google',
  'login.or': 'ឬ',
  'login.emailPlaceholder': 'បញ្ចូល email របស់អ្នក',
  'login.continue': 'បន្ត',
  'login.verify': 'ផ្ទៀងផ្ទាត់',
  'login.footnote':
    'ប្រសិនបើគណនីមិនត្រូវបានរកឃើញក្រោម email នេះ យើងនឹងបង្កើតគណនីសម្រាប់អ្នក។ ដោយបង្កើតគណនី អ្នកយល់ព្រមជាមួយ',
  'login.privacy': 'គោលការណ៍ឯកជនភាព',

  // Create game
  'create.title': 'បង្កើតការលេង',
  'create.opponent': 'អ្នកចង់លេងជាមួយនរណា?',
  'create.friendInvite': 'លេងជាមួយមិត្តភក្តិ',
  'create.friendInviteDesc': 'អ្នកលេងពណ៌បង្កាស់ — ចែករំលែកតំណអញ្ជើញ',
  'create.ai': 'លេងជាមួយ AI',
  'create.aiDesc': 'ជ្រើសរើសម៉ូឌែល ហើយប្រកួតជាមួយកុំព្យូត័រ',
  'create.selectColor': 'ជ្រើសរើសពណ៌របស់អ្នក',
  'create.white': 'ពណ៌បង្កាស់',
  'create.black': 'ពណ៌ខ្មៅ',
  'create.player': 'អ្នកលេង',
  'create.model': 'ម៉ូឌែល',
  'create.playerDesc': 'អ្នកនឹងត្រូវជាអ្នកណាក្នុងការលេងនេះ',
  'create.modelDesc': 'ម៉ូឌែល AI ណាដែលនឹងលេងជាគូប្រកួតរបស់អ្នក',
  'create.create': 'បង្កើតការលេង',
  'create.aiRequired': 'ត្រូវការម៉ូឌែល AI',
  'create.aiRequiredDesc': 'អ្នកត្រូវជ្រើសរើសម៉ូឌែល AI ដើម្បីបន្ត',

  // Invite / PvP
  'invite.title': 'អញ្ជើញមិត្តភក្តិ',
  'invite.desc': 'ផ្ញើតំណនេះ — ពួកគេនឹងមកលេងកៅអីពណ៌ខ្មៅ',
  'invite.copy': 'ចម្លងតំណ',
  'invite.share': 'ចែករំលែក',
  'invite.shareText': 'ខ្ញុំអញ្ជើញអ្នកលេងល្បែងសៀចង្វាយលើ ChessArena ហើយ!',
  'invite.copied': 'បានចម្លងតំណហើយ!',
  'invite.waiting': 'កំពុងរង់ចាំគូប្រកួតមកចូលលេង…',
  'game.wins': 'ឈ្នះ!',
  'game.draw': 'ស្មើគ្នា!',

  // Game
  'game.gameplay': 'ការលេង',
  'game.sidechat': 'ជម្រើសរឿង',
  'game.sidechatDesc': 'និយាយជាមួយអ្នកចាំមើលផ្សេងទៀត',

  // Admin
  'admin.title': 'ផ្ទាំងគ្រប់គ្រង',
  'admin.users': 'អ្នកប្រើសរុប',
  'admin.guests': 'ភ្ញៀវ',
  'admin.games': 'ការលេងសរុប',
  'admin.liveAi': 'ការលេង AI ផ្ទាល់',
  'admin.recentGames': 'ការលេងថ្មីៗ',
  'admin.noGames': 'មិនទាន់មានការលេងទេ។',

  // General
  'common.back': 'ត្រឡប់',
  'common.loading': 'កំពុងផ្ទុក…',
}

export const locales: Record<Locale, Record<string, string>> = { en, kh }

export const LOCALE_STORAGE_KEY = 'chessarena-locale'

export const detectLocale = (): Locale => {
  const saved = localStorage.getItem(LOCALE_STORAGE_KEY) as Locale | null
  if (saved === 'en' || saved === 'kh') return saved

  const nav = (navigator.language || 'en').toLowerCase()
  return nav.startsWith('km') || nav.startsWith('kh') ? 'kh' : 'en'
}
