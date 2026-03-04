import { type ReactNode, createContext, useContext, useState } from "react";

interface DragStateContextType {
  activeId: string | null;
  overId: string | null;
  overPosition: "top" | "bottom" | null;
  setActive: (id: string | null) => void;
  setOver: (id: string | null, position: "top" | "bottom" | null) => void;
}

const DragStateContext = createContext<DragStateContextType>({
  activeId: null,
  overId: null,
  overPosition: null,
  setActive: () => {},
  setOver: () => {},
});

export const useDragState = () => useContext(DragStateContext);

export const DragStateProvider = ({ children }: { children: ReactNode }) => {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [overPosition, setOverPosition] = useState<"top" | "bottom" | null>(null);

  const setActive = (id: string | null) => setActiveId(id);

  const setOver = (id: string | null, position: "top" | "bottom" | null) => {
    setOverId(id);
    setOverPosition(position);
  };

  return (
    <DragStateContext.Provider value={{ activeId, overId, overPosition, setActive, setOver }}>
      {children}
    </DragStateContext.Provider>
  );
};
