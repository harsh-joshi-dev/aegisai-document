// Reusable BrandIcon component representing CA.Dynamix identity
interface BrandIconProps {
    size?: number;
    className?: string;
    color?: string;
    opacity?: number;
}

export function BrandIcon({ size = 24, className = '', color = 'white', opacity = 1 }: BrandIconProps) {
    return (
        <div
            className={className}
            style={{
                width: size,
                height: size,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity
            }}
        >
            <svg
                viewBox="0 0 100 100"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                style={{ width: '100%', height: '100%' }}
            >
                {/* The official white nested triangle 'A' Silhouette */}
                <path
                    d="M50 15L15 85C30 75 70 75 85 85L50 15Z"
                    stroke={color}
                    strokeWidth="3"
                    strokeLinejoin="round"
                />
                <path
                    d="M50 35L30 78C40 73 60 73 70 78L50 35Z"
                    stroke={color}
                    strokeWidth="2.5"
                    strokeLinejoin="round"
                />
                <path
                    d="M50 55L42 75C45 73 55 73 58 75L50 55Z"
                    stroke={color}
                    strokeWidth="2"
                    strokeLinejoin="round"
                    fill={color}
                    fillOpacity="0.2"
                />
            </svg>
        </div>
    );
}
