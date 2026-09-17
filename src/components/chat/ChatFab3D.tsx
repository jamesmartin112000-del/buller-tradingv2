import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XIcon } from 'lucide-react';
/**
 * 3D-feel animated chat FAB.
 * - Floating motion (subtle bob)
 * - Pulsing aura ring
 * - Glossy gradient with inset highlight + drop shadow
 * - Animated chat-bubble + headset glyph that rotates in/out on toggle
 * - Unread badge with bounce
 */
export function ChatFab3D({
  open,
  unread,
  onClick,
  side = 'right',
  offsetX = 20,
  offsetY = 20







}: {open: boolean;unread: number;onClick: () => void;side?: 'left' | 'right';offsetX?: number;offsetY?: number;}) {
  return (
    <motion.div
      initial={{
        scale: 0,
        opacity: 0,
        y: 30
      }}
      animate={{
        scale: 1,
        opacity: 1,
        y: 0
      }}
      transition={{
        delay: 0.4,
        type: 'spring',
        stiffness: 220,
        damping: 18
      }}
      className="fixed z-[10010]"
      style={{
        perspective: 600,
        bottom: offsetY,
        [side]: offsetX
      }}>
      
      {/* Pulsing aura rings (sit behind the button) */}
      <AnimatePresence>
        {!open &&
        <>
            <motion.span
            key="ring-1"
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              background:
              'radial-gradient(circle, rgba(226,191,118,0.45) 0%, transparent 70%)'
            }}
            initial={{
              scale: 1,
              opacity: 0.7
            }}
            animate={{
              scale: 1.9,
              opacity: 0
            }}
            exit={{
              opacity: 0
            }}
            transition={{
              duration: 2.2,
              repeat: Infinity,
              ease: 'easeOut'
            }} />
          
            <motion.span
            key="ring-2"
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              background:
              'radial-gradient(circle, rgba(226,191,118,0.35) 0%, transparent 70%)'
            }}
            initial={{
              scale: 1,
              opacity: 0.6
            }}
            animate={{
              scale: 1.6,
              opacity: 0
            }}
            exit={{
              opacity: 0
            }}
            transition={{
              duration: 2.2,
              repeat: Infinity,
              ease: 'easeOut',
              delay: 1.1
            }} />
          
          </>
        }
      </AnimatePresence>

      {/* The 3D button */}
      <motion.button
        onClick={onClick}
        aria-label={open ? 'Close support chat' : 'Open support chat'}
        whileHover={{
          scale: 1.08,
          rotateX: -8,
          rotateY: 8
        }}
        whileTap={{
          scale: 0.94
        }}
        animate={{
          y: [0, -3, 0]
        }}
        transition={{
          y: {
            duration: 3.2,
            repeat: Infinity,
            ease: 'easeInOut'
          }
        }}
        className="relative w-14 h-14 rounded-full overflow-visible focus:outline-none"
        style={{
          background:
          'radial-gradient(circle at 30% 25%, #f0d89b 0%, #e2bf76 45%, #b89755 100%)',
          boxShadow: `
            0 8px 24px rgba(226,191,118,0.45),
            0 2px 6px rgba(0,0,0,0.5),
            inset 0 1px 1px rgba(255,255,255,0.45),
            inset 0 -3px 8px rgba(0,0,0,0.35)
          `,
          transformStyle: 'preserve-3d'
        }}>
        
        {/* Top glossy highlight */}
        <span
          className="absolute left-2 right-2 top-1.5 h-4 rounded-full pointer-events-none"
          style={{
            background:
            'linear-gradient(to bottom, rgba(255,255,255,0.55), rgba(255,255,255,0))',
            filter: 'blur(1px)'
          }} />
        

        {/* Inner rim ring */}
        <span
          className="absolute inset-[3px] rounded-full pointer-events-none"
          style={{
            boxShadow:
            'inset 0 0 0 1px rgba(255,255,255,0.18), inset 0 -6px 12px rgba(0,0,0,0.25)'
          }} />
        

        {/* Glyph — flips between chat & X with 3D rotation */}
        <span className="absolute inset-0 flex items-center justify-center">
          <AnimatePresence mode="wait" initial={false}>
            {open ?
            <motion.span
              key="close"
              initial={{
                rotateY: 90,
                opacity: 0
              }}
              animate={{
                rotateY: 0,
                opacity: 1
              }}
              exit={{
                rotateY: -90,
                opacity: 0
              }}
              transition={{
                duration: 0.22
              }}
              className="text-white drop-shadow-md"
              style={{
                filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.4))'
              }}>
              
                <XIcon className="w-6 h-6" strokeWidth={2.4} />
              </motion.span> :

            <motion.span
              key="chat"
              initial={{
                rotateY: 90,
                opacity: 0
              }}
              animate={{
                rotateY: 0,
                opacity: 1
              }}
              exit={{
                rotateY: -90,
                opacity: 0
              }}
              transition={{
                duration: 0.22
              }}
              className="h-12 w-12 overflow-hidden rounded-full border border-[#f0d89b]/70"
              style={{
                filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))'
              }}>
              
                <img
                src="/chat_support_icon.png"
                alt=""
                aria-hidden="true"
                className="h-full w-full object-cover" />
              
              </motion.span>
            }
          </AnimatePresence>
        </span>

        {/* Unread badge */}
        <AnimatePresence>
          {!open && unread > 0 &&
          <motion.span
            key="unread"
            initial={{
              scale: 0,
              y: -4
            }}
            animate={{
              scale: 1,
              y: 0
            }}
            exit={{
              scale: 0
            }}
            transition={{
              type: 'spring',
              stiffness: 380,
              damping: 16
            }}
            className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1.5 rounded-full bg-warn text-bg-900 text-2xs font-bold flex items-center justify-center border-2 border-bg-900"
            style={{
              boxShadow:
              '0 2px 6px rgba(255,171,0,0.6), inset 0 1px 1px rgba(255,255,255,0.5)'
            }}>
            
              <motion.span
              animate={{
                scale: [1, 1.18, 1]
              }}
              transition={{
                duration: 1.4,
                repeat: Infinity
              }}>
              
                {unread > 9 ? '9+' : unread}
              </motion.span>
            </motion.span>
          }
        </AnimatePresence>

        {/* Status dot (live) */}
        {!open &&
        <span
          className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-bg-900"
          style={{
            background: '#00c853',
            boxShadow: '0 0 6px rgba(0,200,83,0.7)'
          }} />

        }
      </motion.button>
    </motion.div>);

}