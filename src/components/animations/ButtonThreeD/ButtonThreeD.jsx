import React from "react";
import {motion} from "framer-motion";

const ButtonThreeD = ({sx = 'div',children,style,...props}) => {
const MotionTag = motion(sx)

    return (
        <MotionTag {...props} style={{...style}}>
            {children}
        </MotionTag>
    )
}

export default ButtonThreeD