"use client";

import { useState, useTransition, useMemo, useEffect } from "react";
import type { Bottle, BottleType } from "@/lib/types";
import { updateBottleQuantity, deleteBottleAction } from "@/app/actions";
import ConfirmDeleteModal from "@/components/ConfirmDeleteModal";
import NoticeModal, { type Notice } from "@/components/NoticeModal";
import Pagination from "@/components/Pagination";
import { Sheet, EmptyState } from "@/components/ui";
import AddBottleForm, { type BottlePrefill } from "./AddBottleForm";
import FicheBouteilleSheet from "./FicheBouteilleSheet";
import EditionSheet from "./EditionSheet";
import ScannerSheet from "./ScannerSheet";
import StockFiltres from "./StockFiltres";
import BottleListRow from "./BottleListRow";

const ITEMS_PER_PAGE = 20;

interface StockStudioProps {
  normalBottles: Bottle[];
  vipBottles: Bottle[];
  barId: string;
  isAdmin?: boolean;
  isVip?: boolean;
}

export default function StockStudio({
  normalBottles,
  vipBottles,
  barId,
  isAdmin = false,
  isVip = false,
}: StockStudioProps) {
  const [activeUniverse, setActiveUniverse] = useState<"bar" | "vip" | "shopping">("bar");
  const [selectedCategory, setSelectedCategory] = useState<BottleType | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Les trois frontières de découpe : quelle bouteille est inspectée, si son édition est ouverte par-dessus la fiche, et si le scanner est ouvert.
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  // Posé par un scan, consommé par AddBottleForm ; vidé à chaque fermeture pour qu'un "+ Ajouter" manuel ne rouvre jamais sur des données d'un ancien scan.
  const [prefill, setPrefill] = useState<BottlePrefill | undefined>(undefined);

  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [, startTransition] = useTransition();
  const [isDeletePending, startDeleteTransition] = useTransition();

  useEffect(() => {
    setCurrentPage(1);
  }, [activeUniverse, selectedCategory, searchQuery]);

  const shoppingList = useMemo(() => {
    const listToScan = isVip ? [...normalBottles, ...vipBottles] : normalBottles;
    return listToScan.filter((b) => {
      const threshold = b.lowStockThreshold ?? 0.5;
      return b.quantity <= threshold;
    });
  }, [normalBottles, vipBottles, isVip]);

  const currentList = activeUniverse === "vip" && isVip ? vipBottles : normalBottles;

  const availableCategories = useMemo(() => {
    const set = new Set<BottleType>();
    currentList.forEach((b) => set.add(b.type));
    return Array.from(set);
  }, [currentList]);

  const filteredBottles = useMemo(() => {
    const base = activeUniverse === "shopping" ? shoppingList : currentList;
    return base.filter((b) => {
      const matchesCat = selectedCategory === "all" || b.type === selectedCategory;
      const matchesSearch =
        searchQuery.trim() === "" ||
        b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesCat && matchesSearch;
    });
  }, [activeUniverse, currentList, shoppingList, selectedCategory, searchQuery]);

  const paginatedBottles = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredBottles.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredBottles, currentPage]);
  const totalPages = Math.ceil(filteredBottles.length / ITEMS_PER_PAGE);

  const selectedBottle = useMemo(() => {
    if (!selectedBottleId) return null;
    const all = isVip ? [...normalBottles, ...vipBottles] : normalBottles;
    return all.find((b) => b.id === selectedBottleId) ?? null;
  }, [selectedBottleId, normalBottles, vipBottles, isVip]);

  const closeFiche = () => { setSelectedBottleId(null); setIsEditing(false); };
  const closeAdd = () => { setIsAdding(false); setPrefill(undefined); };
  const changeUniverse = (universe: "bar" | "vip" | "shopping") => {
    setActiveUniverse(universe);
    setSelectedCategory("all");
  };

  // Un scan qui ne trouve rien en stock transmet le code (et ce que la base produit connaît) au formulaire d'ajout.
  const handleScanTrouve: React.ComponentProps<typeof ScannerSheet>["onTrouve"] = (barcode, product) => {
    setIsScanning(false);
    setPrefill({
      barcode,
      name: product?.name,
      type: product?.type,
      imageUrl: product?.imageUrl ?? undefined,
      size: product?.size ?? undefined,
    });
    setIsAdding(true);
  };

  const quickAdjust = (id: string, currentQuantity: number, delta: number) => {
    startTransition(() => {
      updateBottleQuantity(id, currentQuantity + delta);
    });
  };

  const copyShoppingList = async () => {
    const text = shoppingList
      .map((b) => `- ${b.name} (${b.type}) : stock=${b.quantity} (seuil: ${b.lowStockThreshold ?? 0.5})`)
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setNotice({
        accent: "success",
        icon: "📋",
        title: "Liste copiée",
        description: `${shoppingList.length} référence${shoppingList.length > 1 ? "s" : ""} dans le presse-papiers.`,
      });
    } catch {
      setNotice({
        accent: "danger",
        icon: "⚠️",
        title: "Copie impossible",
        description:
          "Le navigateur a refusé l'accès au presse-papiers. Sur mobile, cela arrive hors HTTPS.",
      });
    }
  };

  const exportCsv = () => {
    const escapeCsvField = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const header = ["Nom", "Type", "Quantité", "Tags"].map(escapeCsvField).join(",");
    const rows = filteredBottles.map((b) =>
      [b.name, b.type, String(b.quantity), b.tags.join("; ")].map(escapeCsvField).join(",")
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "stock.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <StockFiltres
        isAdmin={isAdmin} isVip={isVip}
        activeUniverse={activeUniverse} onUniverseChange={changeUniverse}
        normalCount={normalBottles.length} vipCount={vipBottles.length} shoppingCount={shoppingList.length}
        searchQuery={searchQuery} onSearchChange={setSearchQuery}
        selectedCategory={selectedCategory} onCategoryChange={setSelectedCategory}
        availableCategories={availableCategories} currentListCount={currentList.length}
        showCopier={activeUniverse === "shopping" && shoppingList.length > 0}
        showExporter={filteredBottles.length > 0}
        onScanner={() => setIsScanning(true)}
        onAjouter={() => { setPrefill(undefined); setIsAdding(true); }}
        onCopier={copyShoppingList} onExporter={exportCsv}
      />
      {filteredBottles.length === 0 ? (
        <EmptyState titre="Aucune bouteille" message="Aucune bouteille trouvée dans cette sélection." />
      ) : (
        <div className="space-y-3">
          {paginatedBottles.map((bottle) => (
            <BottleListRow
              key={bottle.id}
              bottle={bottle} isAdmin={isAdmin} isVip={isVip}
              onInspecter={() => setSelectedBottleId(bottle.id)}
              onAjuster={(delta) => quickAdjust(bottle.id, bottle.quantity, delta)}
            />
          ))}
        </div>
      )}
      <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />

      <FicheBouteilleSheet
        bouteille={isEditing ? null : selectedBottle} isAdmin={isAdmin}
        onFermer={closeFiche} onEditer={() => setIsEditing(true)}
        onSupprimer={(b) => setDeleteTarget({ id: b.id, name: b.name })}
      />
      <EditionSheet
        bouteille={selectedBottle} ouvert={isEditing} canSeeVip={isVip}
        onFermer={() => setIsEditing(false)}
      />
      {/* Clé sur le code-barres : un second scan doit remonter le formulaire, les champs préremplis étant non contrôlés (defaultValue seul ne les rafraîchirait pas). */}
      <Sheet ouvert={isAdding} titre="Nouvelle Bouteille" onFermer={closeAdd}>
        <AddBottleForm key={prefill?.barcode ?? "manual"} isVip={isVip} barId={barId} onSuccess={closeAdd} prefill={prefill} />
      </Sheet>
      <ScannerSheet ouvert={isScanning} barId={barId} onFermer={() => setIsScanning(false)} onTrouve={handleScanTrouve} />
      <NoticeModal notice={notice} onClose={() => setNotice(null)} />

      <ConfirmDeleteModal
        isOpen={deleteTarget !== null}
        title="Supprimer la bouteille ?"
        description={`Êtes-vous sûr de vouloir supprimer définitivement "${deleteTarget?.name}" ?`}
        isPending={isDeletePending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          const id = deleteTarget.id;
          startDeleteTransition(async () => {
            const res = await deleteBottleAction(id);
            if (res?.error) {
              setDeleteTarget(null);
              setNotice({ accent: "danger", icon: "⚠️", title: "Suppression impossible", description: res.error });
            } else {
              setDeleteTarget(null);
              closeFiche();
            }
          });
        }}
      />
    </div>
  );
}
