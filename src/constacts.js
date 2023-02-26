import sezameScreen from './photo/sezameScreen.png'
import inKinScreen from './photo/inKinScreen.png'
import truckInDigitalScreen from './photo/truckInDigitalscreen.png'
import airdropScreen from './photo/airdropScreen.png'
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


export const palette = {
    green: '#14e956',
    greyBg: '#262626',
    white: '#ffffff',
}

export const MyLinks = [
    {id: 1, title: 'Linkedin', path: 'https://www.linkedin.com/in/arayik-suqiasyan-6069a8210/'},
    {id: 2, type: 'mail', title: 'Mail', path: 'arayiksuqiasyan20@gmail.com'},
    {id: 3, title: 'GitHub', path: 'https://github.com/arayiksuqiasyan'},
]

export const EXPERIENCE = [
    {
        id: 1,
        title: 'Sezame Wallet',
        description: 'A non custodial wallet for digital assets ',
        styleRight:{
            backgroundImage: `url(${sezameScreen})`,
        }
    },
    {
        id: 2,
        title: 'InKin',
        description: 'Corporate Wellness: Online Fitness Challenges and Team Battles ',
        styleRight:{
            backgroundImage: `url(${inKinScreen})`,
        }
    },
    {
        id: 3,
        title: 'Truck in Digital',
        description: 'Streamline Trucking Operations in the Cloud.',
        styleRight:{
            backgroundImage: `url(${truckInDigitalScreen})`,
        }
    },
    {
        id: 4,
        title: 'Airdrop',
        description: 'Best spot to get informed about current and future airdrops.',
        styleRight:{
            backgroundImage: `url(${airdropScreen})`,
        }

    },
]

export const TOOLS = [
    {id:1, name:'HTML'},
    {id:2, name:'CSS'},
    {id:3, name:'JavaScript'},
    {id:4, name:'Agile'},
    {id:5, name:'Kanban'},
    {id:6, name:'Scrum'},
    {id:7, name:'React'},
    {id:8, name:'React Router Dom'},
    {id:9, name:'React Native'},
    {id:10, name:'Angular'},
    {id:11, name:'TypeScript'},
    {id:12, name:'Antd'},
    {id:13, name:'Materialize'},
    {id:14, name:'Redux'},
    {id:15, name:'Redux Thank'},
    {id:16, name:'Redux Saga'},
    {id:17, name:'Redux Toolkit'},
    {id:18, name:'MobX'},
    {id:19, name:'Bootstrap'},
    {id:20, name:'Git/Github'},
    {id:21, name:'Less'},
    {id:22, name:'Scss'},
    {id:23, name:'OOP'},
    {id:24, name:'Express'},
    {id:25, name:'Node js'},
    {id:26, name:'Nest js'},
    {id:27, name:'REST API'},
    {id:28, name:'Styled Components'},
    {id:29, name:'Docker'},
    {id:30, name:'WebSockets'},
    {id:31, name:'Framer Motion'}
]

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

export function debounce(cb, time = 300) {
    let timeOut;
    return function () {
        const fnCall = () => {
            cb.apply(this, arguments)
        }

        clearTimeout(timeOut)
        timeOut = setTimeout(fnCall, time)


    }
}