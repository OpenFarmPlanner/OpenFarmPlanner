"""Central seed data for official crop-library species."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class CropSpeciesSeedEntry:
    """Language-independent species entry prepared for later translations."""

    key: str
    translations: dict[str, str]


CROP_SPECIES_SEED_DATA: tuple[CropSpeciesSeedEntry, ...] = (
    CropSpeciesSeedEntry(key='amaranth', translations={'de': 'Amaranth', 'en': 'Amaranth'}),
    CropSpeciesSeedEntry(key='apple', translations={'de': 'Apfel', 'en': 'Apple'}),
    CropSpeciesSeedEntry(key='apricot', translations={'de': 'Marille', 'en': 'Apricot'}),
    CropSpeciesSeedEntry(key='aubergine', translations={'de': 'Aubergine', 'en': 'Eggplant'}),
    CropSpeciesSeedEntry(key='basil', translations={'de': 'Basilikum', 'en': 'Basil'}),
    CropSpeciesSeedEntry(key='bean', translations={'de': 'Bohne', 'en': 'Bean'}),
    CropSpeciesSeedEntry(key='beetroot', translations={'de': 'Rote Rübe', 'en': 'Beetroot'}),
    CropSpeciesSeedEntry(key='black_salsify', translations={'de': 'Schwarzwurzel', 'en': 'Black salsify'}),
    CropSpeciesSeedEntry(key='blueberry', translations={'de': 'Heidelbeere', 'en': 'Blueberry'}),
    CropSpeciesSeedEntry(key='broad_bean', translations={'de': 'Ackerbohne', 'en': 'Broad bean'}),
    CropSpeciesSeedEntry(key='broccoli', translations={'de': 'Brokkoli', 'en': 'Broccoli'}),
    CropSpeciesSeedEntry(key='brussels_sprout', translations={'de': 'Rosenkohl', 'en': 'Brussels sprout'}),
    CropSpeciesSeedEntry(key='buckwheat', translations={'de': 'Buchweizen', 'en': 'Buckwheat'}),
    CropSpeciesSeedEntry(key='cabbage', translations={'de': 'Weißkraut', 'en': 'White cabbage'}),
    CropSpeciesSeedEntry(key='carrot', translations={'de': 'Karotte', 'en': 'Carrot'}),
    CropSpeciesSeedEntry(key='cauliflower', translations={'de': 'Karfiol', 'en': 'Cauliflower'}),
    CropSpeciesSeedEntry(key='celeriac', translations={'de': 'Knollensellerie', 'en': 'Celeriac'}),
    CropSpeciesSeedEntry(key='celery', translations={'de': 'Stangensellerie', 'en': 'Celery'}),
    CropSpeciesSeedEntry(key='chard', translations={'de': 'Mangold', 'en': 'Chard'}),
    CropSpeciesSeedEntry(key='cherry', translations={'de': 'Kirsche', 'en': 'Cherry'}),
    CropSpeciesSeedEntry(key='chervil', translations={'de': 'Kerbel', 'en': 'Chervil'}),
    CropSpeciesSeedEntry(key='chicory', translations={'de': 'Chicorée', 'en': 'Chicory'}),
    CropSpeciesSeedEntry(key='chili', translations={'de': 'Chili', 'en': 'Chili pepper'}),
    CropSpeciesSeedEntry(key='chives', translations={'de': 'Schnittlauch', 'en': 'Chives'}),
    CropSpeciesSeedEntry(key='coriander', translations={'de': 'Koriander', 'en': 'Coriander'}),
    CropSpeciesSeedEntry(key='corn_salad', translations={'de': 'Feldsalat', 'en': 'Corn salad'}),
    CropSpeciesSeedEntry(key='cucumber', translations={'de': 'Gurke', 'en': 'Cucumber'}),
    CropSpeciesSeedEntry(key='currant', translations={'de': 'Ribisel', 'en': 'Currant'}),
    CropSpeciesSeedEntry(key='dill', translations={'de': 'Dill', 'en': 'Dill'}),
    CropSpeciesSeedEntry(key='endive', translations={'de': 'Endivie', 'en': 'Endive'}),
    CropSpeciesSeedEntry(key='fennel', translations={'de': 'Fenchel', 'en': 'Fennel'}),
    CropSpeciesSeedEntry(key='garlic', translations={'de': 'Knoblauch', 'en': 'Garlic'}),
    CropSpeciesSeedEntry(key='gooseberry', translations={'de': 'Stachelbeere', 'en': 'Gooseberry'}),
    CropSpeciesSeedEntry(key='grape', translations={'de': 'Weintraube', 'en': 'Grape'}),
    CropSpeciesSeedEntry(key='green_manure', translations={'de': 'Gründüngung', 'en': 'Green manure'}),
    CropSpeciesSeedEntry(key='horseradish', translations={'de': 'Kren', 'en': 'Horseradish'}),
    CropSpeciesSeedEntry(key='jerusalem_artichoke', translations={'de': 'Topinambur', 'en': 'Jerusalem artichoke'}),
    CropSpeciesSeedEntry(key='kale', translations={'de': 'Grünkohl', 'en': 'Kale'}),
    CropSpeciesSeedEntry(key='kohlrabi', translations={'de': 'Kohlrabi', 'en': 'Kohlrabi'}),
    CropSpeciesSeedEntry(key='leek', translations={'de': 'Lauch', 'en': 'Leek'}),
    CropSpeciesSeedEntry(key='lettuce', translations={'de': 'Salat', 'en': 'Lettuce'}),
    CropSpeciesSeedEntry(key='lovage', translations={'de': 'Liebstöckel', 'en': 'Lovage'}),
    CropSpeciesSeedEntry(key='maize', translations={'de': 'Mais', 'en': 'Maize'}),
    CropSpeciesSeedEntry(key='marjoram', translations={'de': 'Majoran', 'en': 'Marjoram'}),
    CropSpeciesSeedEntry(key='melon', translations={'de': 'Melone', 'en': 'Melon'}),
    CropSpeciesSeedEntry(key='mint', translations={'de': 'Minze', 'en': 'Mint'}),
    CropSpeciesSeedEntry(key='mustard', translations={'de': 'Senf', 'en': 'Mustard'}),
    CropSpeciesSeedEntry(key='oat', translations={'de': 'Hafer', 'en': 'Oat'}),
    CropSpeciesSeedEntry(key='onion', translations={'de': 'Zwiebel', 'en': 'Onion'}),
    CropSpeciesSeedEntry(key='oregano', translations={'de': 'Oregano', 'en': 'Oregano'}),
    CropSpeciesSeedEntry(key='pak_choi', translations={'de': 'Pak Choi', 'en': 'Pak choi'}),
    CropSpeciesSeedEntry(key='parsley', translations={'de': 'Petersilie', 'en': 'Parsley'}),
    CropSpeciesSeedEntry(key='parsnip', translations={'de': 'Pastinake', 'en': 'Parsnip'}),
    CropSpeciesSeedEntry(key='pea', translations={'de': 'Erbse', 'en': 'Pea'}),
    CropSpeciesSeedEntry(key='pear', translations={'de': 'Birne', 'en': 'Pear'}),
    CropSpeciesSeedEntry(key='pepper', translations={'de': 'Paprika', 'en': 'Sweet pepper'}),
    CropSpeciesSeedEntry(key='plum', translations={'de': 'Zwetschke', 'en': 'Plum'}),
    CropSpeciesSeedEntry(key='potato', translations={'de': 'Kartoffel', 'en': 'Potato'}),
    CropSpeciesSeedEntry(key='pumpkin', translations={'de': 'Kürbis', 'en': 'Pumpkin'}),
    CropSpeciesSeedEntry(key='quince', translations={'de': 'Quitte', 'en': 'Quince'}),
    CropSpeciesSeedEntry(key='radicchio', translations={'de': 'Radicchio', 'en': 'Radicchio'}),
    CropSpeciesSeedEntry(key='radish', translations={'de': 'Radieschen', 'en': 'Radish'}),
    CropSpeciesSeedEntry(key='ramson', translations={'de': 'Bärlauch', 'en': 'Ramson'}),
    CropSpeciesSeedEntry(key='raspberry', translations={'de': 'Himbeere', 'en': 'Raspberry'}),
    CropSpeciesSeedEntry(key='red_cabbage', translations={'de': 'Rotkraut', 'en': 'Red cabbage'}),
    CropSpeciesSeedEntry(key='rhubarb', translations={'de': 'Rhabarber', 'en': 'Rhubarb'}),
    CropSpeciesSeedEntry(key='rosemary', translations={'de': 'Rosmarin', 'en': 'Rosemary'}),
    CropSpeciesSeedEntry(key='runner_bean', translations={'de': 'Stangenbohne', 'en': 'Runner bean'}),
    CropSpeciesSeedEntry(key='rye', translations={'de': 'Roggen', 'en': 'Rye'}),
    CropSpeciesSeedEntry(key='sage', translations={'de': 'Salbei', 'en': 'Sage'}),
    CropSpeciesSeedEntry(key='savoy_cabbage', translations={'de': 'Wirsing', 'en': 'Savoy cabbage'}),
    CropSpeciesSeedEntry(key='shallot', translations={'de': 'Schalotte', 'en': 'Shallot'}),
    CropSpeciesSeedEntry(key='spinach', translations={'de': 'Spinat', 'en': 'Spinach'}),
    CropSpeciesSeedEntry(key='spring_onion', translations={'de': 'Frühlingszwiebel', 'en': 'Spring onion'}),
    CropSpeciesSeedEntry(key='strawberry', translations={'de': 'Erdbeere', 'en': 'Strawberry'}),
    CropSpeciesSeedEntry(key='summer_squash', translations={'de': 'Zucchini', 'en': 'Zucchini'}),
    CropSpeciesSeedEntry(key='sweet_potato', translations={'de': 'Süßkartoffel', 'en': 'Sweet potato'}),
    CropSpeciesSeedEntry(key='thyme', translations={'de': 'Thymian', 'en': 'Thyme'}),
    CropSpeciesSeedEntry(key='tomato', translations={'de': 'Tomate', 'en': 'Tomato'}),
    CropSpeciesSeedEntry(key='turnip', translations={'de': 'Speiserübe', 'en': 'Turnip'}),
    CropSpeciesSeedEntry(key='walnut', translations={'de': 'Walnuss', 'en': 'Walnut'}),
    CropSpeciesSeedEntry(key='watermelon', translations={'de': 'Wassermelone', 'en': 'Watermelon'}),
    CropSpeciesSeedEntry(key='wheat', translations={'de': 'Weizen', 'en': 'Wheat'}),
)


def get_crop_species_seed_name(entry: CropSpeciesSeedEntry, language_code: str = 'de') -> str:
    """Return the best display name currently supported by the species model."""
    return entry.translations.get(language_code) or entry.translations['de']
