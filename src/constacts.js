import inkinShot from './photo/portfolio/inkin.jpg'
import sezameShot from './photo/portfolio/sezame.jpg'
import airdropShot from './photo/portfolio/airdrop.jpg'
import slider from './photo/slider.png'
import pokemon from './photo/pokemon.png'
import gallery from './photo/gallery.png'
import drag from './photo/drag.png'
import board from './photo/board.png'
import poekapi from './photo/poekapi.png'
import fileSystem from './photo/file-system.png'
import classTodo from './photo/classTodo.png'
import moneyRt from './photo/moneyRt.png'
import suffixTree from './photo/suffix-tree.png'


export const MyLinks = [
    {id: 1, title: 'LinkedIn', path: 'https://www.linkedin.com/in/arayik-suqiasyan-6069a8210'},
    {id: 2, title: 'Upwork', path: 'https://www.upwork.com/freelancers/~010bf3aba21bc10d87'},
    {id: 3, title: 'GitHub', path: 'https://github.com/arayiksuqiasyan'},
    {id: 4, type: 'mail', title: 'Mail', path: 'arayiksuqiasyan20@gmail.com'},
]

export const STATS = [
    {id: 1, value: 5, suffix: '+', label: 'years of experience'},
    {id: 2, value: 1.5, suffix: 'M+', label: 'players in a game shipped in 2 months', decimals: 1},
    {id: 3, value: 15, suffix: '+', label: 'partner integrations on one platform'},
    {id: 4, value: 180, suffix: '+', label: 'legal document templates automated'},
]

export const EXPERIENCE = [
    {
        id: 1,
        role: 'Fullstack Developer',
        company: 'Government sector (NDA)',
        location: 'Remote',
        period: 'May 2026 – Present',
        description: 'Enterprise B2G procurement system: 180+ legally binding document templates, PostgreSQL migrations, Laravel REST API, Angular 14 + Kendo UI, contract complaint tracking with auto-locking.',
    },
    {
        id: 2,
        role: 'Fullstack Developer (Next.js)',
        company: 'Freelance · Book Platform',
        location: 'Remote',
        period: 'May 2026 – Present',
        description: 'Paid-access platform for a business book in 6 formats: Next.js 16, React 19, Payload CMS, PostgreSQL, Prisma. 3D page-flip PDF/ePub reader and secure HLS audiobook player (AES-128 key rotation, one-time tokens).',
    },
    {
        id: 3,
        role: 'Senior Angular Developer',
        company: 'GSoftX',
        period: 'Dec 2024 – Apr 2026',
        description: 'Architected a multi-partner iGaming platform (casino, sportsbook, betslip) on modern Angular with Signals and zoneless change detection, 15+ partner integrations via iframe.',
    },
    {
        id: 4,
        role: 'Frontend Team Lead',
        company: 'Beavers Brothers Global',
        period: 'Oct 2024 – Dec 2024',
        description: 'Led the team that shipped an animated card game for MegaMarket in 2 months (Next.js, Zustand, Framer Motion) — 1.5M+ players.',
    },
    {
        id: 5,
        role: 'Senior Angular Developer',
        company: 'CincoMatic',
        period: 'Jul 2023 – Dec 2024',
        description: 'Real-time sports betting app over WebSocket, themed for multiple partners with SCSS mixins and Pug.',
    },
    {
        id: 6,
        role: 'Angular Developer',
        company: 'PASCO',
        period: 'Apr 2023 – Sep 2023',
        description: 'Reusable Angular UI components for a B2B supplier-client platform.',
    },
    {
        id: 7,
        role: 'Senior React Developer',
        company: 'Truck in Digital',
        period: 'Sep 2022 – Mar 2023',
        description: 'Logistics ERP from scratch: Trimble Maps GPS tracking, complex forms, real-time tables with Pusher.js, capacity calculations.',
    },
    {
        id: 8,
        role: 'React Developer',
        company: 'Airdrop.com',
        period: 'Jul 2022 – Dec 2022',
        description: 'Web3 frontend (wallet connection, reward claiming, Redux Saga) plus NestJS / MongoDB backend.',
    },
    {
        id: 9,
        role: 'React Native Developer',
        company: 'Sezame Wallet',
        period: 'Jan 2022 – Jul 2022',
        description: 'Crypto wallet for iOS / Android: Face ID, secret phrase auth, camera, navigation.',
    },
    {
        id: 10,
        role: 'React / React Native Developer',
        company: 'Minnova.am (inKin)',
        period: 'Sep 2020 – Dec 2021',
        description: 'Web and mobile apps: Google Maps, native step tracking, push notifications.',
    },
]

export const PORTFOLIO = [
    {
        id: 1,
        title: 'inKin',
        url: 'https://www.inkin.com/',
        stack: 'React · React Native',
        description: 'Corporate wellness: online fitness challenges and team battles.',
        image: inkinShot,
    },
    {
        id: 2,
        title: 'Sezame Wallet',
        url: 'https://sezame.app/',
        stack: 'React Native · Web3',
        description: 'A non-custodial mobile wallet for digital assets.',
        image: sezameShot,
    },
    {
        id: 3,
        title: 'Airdrop',
        url: 'https://airdrop.com/',
        stack: 'React · Web3 · NestJS',
        description: 'Discover and claim the best reward airdrops.',
        image: airdropShot,
    },
]

export const SKILLS = {
    'Frontend': ['React', 'Next.js', 'Angular (Signals, NgRx)', 'Vue 3', 'React Native', 'TypeScript', 'JavaScript'],
    'State & forms': ['Redux', 'Redux Saga', 'Zustand', 'MobX', 'Pinia', 'React Hook Form', 'Formik'],
    'UI': ['Tailwind CSS', 'SCSS', 'shadcn/ui', 'MUI', 'Ant Design', 'PrimeNG', 'Kendo UI', 'Framer Motion'],
    'Backend & data': ['Node.js', 'NestJS', 'PHP', 'Laravel', 'PostgreSQL', 'Prisma', 'MongoDB', 'Payload CMS'],
    'Real-time & tools': ['WebSocket', 'Pusher.js', 'HLS', 'AG Grid', 'Docker', 'Git', 'Jira', 'Confluence'],
}

export const TOOLS = Object.values(SKILLS).flat().map((name, i) => ({id: i + 1, name}))

export const GIT_WORKS = [
    {id:1,img:slider, url:'https://arayiksuqiasyan.github.io/slider/',title:'Slider'},
    {id:2,img:pokemon, url:'https://arayiksuqiasyan.github.io/pokemon/',title:'Pokemon'},
    {id:3,img:gallery, url:'https://arayiksuqiasyan.github.io/gallery/',title:'Gallery'},
    {id:4,img:drag, url:'https://arayiksuqiasyan.github.io/drag/',title:'Drag'},
    {id:5,img:board, url:'https://arayiksuqiasyan.github.io/board/',title:'Board'},
    {id:6,img:poekapi, url:'https://arayiksuqiasyan.github.io/detiles/lugia',title:'Pokemon Api'},
    {id:7,img:fileSystem, url:'https://arayiksuqiasyan.github.io/file-system/#/',title:'File-System'},
    {id:8,img:classTodo, url:'https://arayiksuqiasyan.github.io/react-class-componet/',title:'class-component-list'},
    {id:9,img:moneyRt, url:'https://arayiksuqiasyan.github.io/money-RT/#/works',title:'money-RT'},
    {id:10,img:suffixTree, url:'https://arayiksuqiasyan.github.io/suffix-tree/',title:'Suffix-tree'},
]
