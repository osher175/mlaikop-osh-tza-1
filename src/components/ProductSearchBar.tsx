
import React, { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Package, MapPin, Calendar, Loader2 } from 'lucide-react';
import { useProductSearch, useProductAutocomplete } from '@/hooks/useProductSearch';
import { cn } from '@/lib/utils';

interface ProductSearchBarProps {
  onProductSelect?: (product: any) => void;
  placeholder?: string;
  className?: string;
  showResults?: boolean;
}

export const ProductSearchBar: React.FC<ProductSearchBarProps> = ({
  onProductSelect,
  placeholder = "חפש מוצרים...",
  className,
  showResults = true,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const { searchResults, isSearching } = useProductSearch(searchTerm, searchTerm.length > 0);
  const { suggestions, isLoadingSuggestions } = useProductAutocomplete(searchTerm, searchTerm.length >= 2);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (resultsRef.current && !resultsRef.current.contains(event.target as Node) &&
          inputRef.current && !inputRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;

    const totalItems = suggestions.length + searchResults.length;
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev < totalItems - 1 ? prev + 1 : -1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev > -1 ? prev - 1 : totalItems - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0) {
          if (selectedIndex < suggestions.length) {
            // Selected a suggestion
            setSearchTerm(suggestions[selectedIndex].suggestion);
            setIsOpen(false);
          } else {
            // Selected a product
            const productIndex = selectedIndex - suggestions.length;
            const selectedProduct = searchResults[productIndex];
            onProductSelect?.(selectedProduct);
            setIsOpen(false);
          }
        }
        break;
      case 'Escape':
        setIsOpen(false);
        inputRef.current?.blur();
        break;
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    setIsOpen(value.length > 0);
    setSelectedIndex(-1);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setSearchTerm(suggestion);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const handleProductClick = (product: any) => {
    onProductSelect?.(product);
    setIsOpen(false);
  };

  const getStatusBadge = (quantity: number) => {
    if (quantity === 0) {
      return <Badge className="bg-red-500 text-white text-xs">אזל</Badge>;
    } else if (quantity <= 5) {
      return <Badge className="bg-yellow-500 text-white text-xs">נמוך</Badge>;
    } else {
      return <Badge className="bg-green-500 text-white text-xs">במלאי</Badge>;
    }
  };

  return (
    <div className={cn("relative w-full", className)} dir="rtl">
      <div className="relative">
        <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
        <Input
          ref={inputRef}
          value={searchTerm}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => searchTerm.length > 0 && setIsOpen(true)}
          placeholder={placeholder}
          className="pr-10 font-rubik"
        />
        {(isSearching || isLoadingSuggestions) && (
          <Loader2 className="absolute left-3 top-1/2 transform -translate-y-1/2 text-primary w-4 h-4 animate-spin" />
        )}
      </div>

      {/* Results Dropdown */}
      {isOpen && showResults && (searchResults.length > 0 || suggestions.length > 0) && (
        <Card 
          ref={resultsRef}
          className="absolute top-full left-0 right-0 mt-1 max-h-96 overflow-y-auto z-50 shadow-lg border border-gray-200"
        >
          {/* Autocomplete Suggestions */}
          {suggestions.length > 0 && (
            <div className="border-b border-gray-100">
              <div className="px-3 py-2 text-xs font-medium text-gray-500 font-rubik">
                הצעות חיפוש
              </div>
              {suggestions.map((suggestion, index) => (
                <div
                  key={suggestion.suggestion}
                  className={cn(
                    "px-3 py-2 hover:bg-gray-50 cursor-pointer flex items-center justify-between",
                    selectedIndex === index && "bg-primary-50"
                  )}
                  onClick={() => handleSuggestionClick(suggestion.suggestion)}
                >
                  <span className="font-rubik text-sm">{suggestion.suggestion}</span>
                  <Badge variant="outline" className="text-xs">
                    {suggestion.product_count}
                  </Badge>
                </div>
              ))}
            </div>
          )}

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div>
              <div className="px-3 py-2 text-xs font-medium text-gray-500 font-rubik">
                תוצאות חיפוש ({searchResults.length})
              </div>
              {searchResults.map((product, index) => {
                const actualIndex = suggestions.length + index;
                return (
                  <div
                    key={product.id}
                    className={cn(
                      "px-3 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-50 last:border-b-0",
                      selectedIndex === actualIndex && "bg-primary-50"
                    )}
                    onClick={() => handleProductClick(product)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-gray-400" />
                        <span className="font-medium font-rubik text-sm">{product.name}</span>
                      </div>
                      {getStatusBadge(product.quantity)}
                    </div>
                    
                    <div className="flex items-center gap-4 text-xs text-gray-500 font-rubik">
                      <div className="flex items-center gap-1">
                        <span>כמות: {product.quantity}</span>
                      </div>
                      {product.location && (
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          <span>{product.location}</span>
                        </div>
                      )}
                      {product.expiration_date && (
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          <span>{new Date(product.expiration_date).toLocaleDateString('he-IL')}</span>
                        </div>
                      )}
                      {product.barcode && (
                        <span className="text-gray-400">#{product.barcode}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}
    </div>
  );
};
