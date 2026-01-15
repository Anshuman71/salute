import { customAlphabet } from 'nanoid';
import { useState, useEffect } from 'react'


export function usePlayerId() {
    const [playerId, setPlayerId] = useState<string>("");

    useEffect(() => {
        const storedPlayerId = localStorage.getItem('salute_playerId');
        if (storedPlayerId) {
            setPlayerId(storedPlayerId);
        } else {
            const uid = customAlphabet('1234567890abcdefghijklmnopqrstuvwxyz', 8)();
            const newId = `ply_${uid}`;
            localStorage.setItem('salute_playerId', newId);
            setPlayerId(newId);
        }
    }, []);

    return playerId
}