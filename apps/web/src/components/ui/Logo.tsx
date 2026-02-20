import React from 'react';

interface LogoProps {
    className?: string;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    showText?: boolean;
}

export const Logo: React.FC<LogoProps> = ({ size = 'md', showText = true, className = '' }) => {
    const iconSizes = {
        sm: 32,
        md: 48,
        lg: 64,
        xl: 120,
    };

    const iconSize = iconSizes[size];

    return (
        <div className={`flex items-center ${className}`} style={{ gap: size === 'xl' ? '24px' : size === 'lg' ? '12px' : '10px', maxWidth: '100%' }}>
            {/* Icon - White Nested Triangle A Silhouette */}
            <div
                style={{
                    width: iconSize,
                    height: iconSize,
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                }}
            >
                <svg
                    viewBox="0 0 100 100"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    style={{ width: '100%', height: '100%' }}
                >
                    <path
                        d="M50 15L15 85C30 75 70 75 85 85L50 15Z"
                        stroke="white"
                        strokeWidth="3"
                        strokeLinejoin="round"
                    />
                    <path
                        d="M50 35L30 78C40 73 60 73 70 78L50 35Z"
                        stroke="white"
                        strokeWidth="2.5"
                        strokeLinejoin="round"
                    />
                    <path
                        d="M50 55L42 75C45 73 55 73 58 75L50 55Z"
                        stroke="white"
                        strokeWidth="2"
                        strokeLinejoin="round"
                        fill="white"
                        fillOpacity="0.2"
                    />
                </svg>
            </div>

            {showText && (
                <div className="flex items-center" style={{ gap: size === 'xl' ? '12px' : '8px', minWidth: 0 }}>
                    {/* Vertical Bar with Gradient */}
                    <div
                        style={{
                            width: size === 'xl' ? '6px' : '2px',
                            height: size === 'xl' ? '80px' : size === 'lg' ? '28px' : '24px',
                            background: 'linear-gradient(to bottom, #6366f1, #d946ef)',
                            borderRadius: '99px',
                            flexShrink: 0
                        }}
                    />

                    {/* Text Content */}
                    <div className="flex flex-col justify-center overflow-hidden" style={{ minWidth: 0 }}>
                        <h1
                            style={{
                                margin: 0,
                                padding: 0,
                                color: 'white',
                                fontWeight: 950,
                                fontFamily: 'Outfit, Inter, sans-serif',
                                letterSpacing: size === 'sm' ? '0.08em' : '0.12em',
                                lineHeight: 1.1,
                                fontSize: size === 'xl' ? '52px' : size === 'lg' ? '24px' : '18px',
                                textTransform: 'uppercase',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            CA.DYNAMIX
                        </h1>
                        <p
                            style={{
                                margin: size === 'xl' ? '8px 0 0 0' : '2px 0 0 0',
                                padding: 0,
                                color: 'rgba(255, 255, 255, 0.4)',
                                fontWeight: 700,
                                letterSpacing: size === 'sm' ? '0.15em' : '0.25em',
                                fontSize: size === 'xl' ? '14px' : size === 'lg' ? '9px' : '7px',
                                textTransform: 'uppercase',
                                whiteSpace: 'nowrap',
                                opacity: 0.8
                            }}
                        >
                            REDEFINING CA INTELLIGENCE
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};
