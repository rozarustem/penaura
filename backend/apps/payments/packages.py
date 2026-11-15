"""Tanga paketlari. Narx FAQAT serverda belgilanadi (frontend'dagi narxga ishonilmaydi).

frontend/js/coin-checkout.js dagi paketlar bilan bir xil bo'lishi kerak.
price - so'mda.
"""

PACKAGES = {
    "5": {"coins": 5, "bonus": 0, "price": 10000},
    "15": {"coins": 15, "bonus": 2, "price": 25000},
    "40": {"coins": 40, "bonus": 8, "price": 60000},
    "100": {"coins": 100, "bonus": 25, "price": 140000},
}
