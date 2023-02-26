import React, {useCallback, useEffect, useRef, useState} from "react";
import classes from './Header.module.scss'
import {MyLinks} from "../../constacts";
import ButtonThreeD from "../../components/animations/ButtonThreeD/ButtonThreeD";


export const Header = () => {
    const refSettings = useRef(null)
    const refModal = useRef(null)
    const timeOut = useRef(undefined)
    const [isOpen, setIsOpen] = useState(false)

    function onClickHandler(e) {
        e.stopPropagation()
        const el = refSettings.current
        const settings = el?.classList?.contains('icon-settings')

        el.style.transform = 'rotate(-180deg) scale(0.4)'
        settings ? setIsOpen(true) : setIsOpen(false)
        timeOut.current = setTimeout(() => {
            if (settings) {
                el.classList.remove('icon-settings')
                el.classList.add('icon-close')
            } else {
                el.classList.remove('icon-close')
                el.classList.add('icon-settings')
            }

            el.style.transform = 'rotate(0) scale(1)'
        }, 300)

    }

    const onClickWindowHandler = useCallback((e) => {
        if (!refModal.current.contains(e.target)) {
            const el = refSettings.current
            if (isOpen) {
                setIsOpen(false)
                el.style.transform = 'rotate(-180deg) scale(0.4)'
            }

            timeOut.current = setTimeout(() => {
                el.classList.remove('icon-close')
                el.classList.add('icon-settings')
                el.style.transform = 'rotate(0) scale(1)'
            }, 300)
        }
    }, [isOpen])

    useEffect(() => {
        return () => clearTimeout(timeOut?.current)
    }, [])

    useEffect(() => {
        window.addEventListener('click', onClickWindowHandler)
        return () => {
            window?.removeEventListener('click', onClickWindowHandler)
        }
    }, [onClickWindowHandler])

    return (
        <div className={classes.container}>
            <nav className={classes.appNavBar}>
                <div className={classes.navLogo}>
                    <span className={`icon-user ${classes.icon}`}/>
                </div>
                <div className={classes.navMenu}>
                    <div className={classes.zombieWrapper}>

                        <div
                            className={classes.iconWrapper}
                            onClick={onClickHandler}
                        >
                        <span
                            ref={refSettings}
                            className={`icon-settings ${classes.settings}`}
                        />
                        </div>
                    </div>

                    <div ref={refModal} className={`${classes.modal} ${isOpen ? classes.open : ''}`}>
                        {
                            MyLinks.map((item, index) => {
                                const {type, path, title} = item || {}
                                return (
                                    <ButtonThreeD
                                        sx={'a'}
                                        key={item.id}
                                        rel="noreferrer"
                                        target={'_blank'}
                                        style={{animationDelay: `0.1${index}s`}}
                                        href={`${type === 'mail' ? 'mailto:' : ''} ${path}`}
                                    >
                                        {title}
                                    </ButtonThreeD>

                                )
                            })
                        }
                    </div>
                </div>
            </nav>
        </div>
    )
}
