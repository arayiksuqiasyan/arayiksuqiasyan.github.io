import React, {useEffect, useLayoutEffect, useMemo, useRef, useState} from "react";
import classes from './Experience.module.scss'
import {debounce, EXPERIENCE} from "../../constacts";
import dust from '../../photo/dust2.png'
import {
    motion,
    useMotionValue,
    useMotionValueEvent,
    useScroll,
    useSpring,
    useTransform,
    useVelocity,
} from "framer-motion";
import closeSound from '../../sounds/closeSound.wav'
import dragsSound from '../../sounds/drags.mp3'

export const Experience = () => {

    return (
        <div className={classes.container}>
            {EXPERIENCE.map((el, index) => {
                return <ExperienceItem key={el.id} el={el}/>

            })}
        </div>
    )
}

const ExperienceItem = ({el}) => {
    const audioDrags = useRef(new Audio(dragsSound))
    const audio = useRef(new Audio(closeSound))
    const ref = useRef(null)
    const [closed, setClosed] = useState(false)
    const scaleMotionValue = useMotionValue(1)
    const {scrollYProgress} = useScroll({target: ref, offset: ["320px end", "start 100px"]})

    const scalePurple = useSpring(scaleMotionValue, {stiffness: 600, damping: 20})

    const translateXLeft = useTransform(scrollYProgress, [0, 1], ['40.9%', '0%'])
    const translateXRight = useTransform(scrollYProgress, [0, 1], ['-40.9%', '0%'])

    const debounceSound = useMemo(() => {
        return debounce(() => {
            audioDrags.current.pause()
            audioDrags.current.currentTime = 0
        }, 300)
    }, [debounce])

    useEffect(() => {
        function onChangeTranslateX(value) {
            if (value === "40.9%") {
                scaleMotionValue.set(1.05)
                scalePurple.on("change", latest => {
                    if (+latest.toFixed(2) === 1.05) {
                        scaleMotionValue.jump(1)
                    }
                })

                setClosed(true)
                audio.current.currentTime = 0.5
                audio.current.volume = 0.7
                audioDrags.current.pause()
                audioDrags.current.currentTime = 0
                audio?.current?.play()

            } else {
                setClosed(false)
            }
        }

        function onChangeScroll() {
            audioDrags.current.volume = 0.3
            audioDrags.current.play()
            debounceSound()
        }

        let translateXLeftSubscribe = null;
        let scrollYProgressSubscribe = null;
        if (window.innerWidth > 460) {
            translateXLeftSubscribe = translateXLeft.on("change", onChangeTranslateX)
            scrollYProgressSubscribe = scrollYProgress.on('change', onChangeScroll)
        }
        return () => {
            if (window.innerWidth > 460) {
                !!translateXLeftSubscribe && translateXLeftSubscribe()
                !!scrollYProgressSubscribe && scrollYProgressSubscribe()
            }
        }
    }, [debounceSound])



    return (
        <div
            ref={ref}
            className={classes.card}>
            <motion.div
                style={{translateX: translateXLeft, scale: scalePurple}}
                className={classes.left}>
                <motion.span className={classes.title}>
                    {el.title}
                </motion.span>
                <span className={classes.description}>{el.description}</span>
            </motion.div>
            <div className={classes.rightWrapper}>
                <motion.div
                    style={{translateX: translateXRight, scale: scalePurple, ...el?.styleRight}}
                    className={classes.right}>
                </motion.div>
                <motion.img
                    src={dust}
                    className={`${classes.dust} ${closed ? classes.active : ''}`}
                    style={{
                        translateX: translateXRight,
                        scale: closed ? 1.4 : 0,
                    }}

                />
            </div>

        </div>
    )
}
