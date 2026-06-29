from pydantic import BaseModel


class GlobalStatsResponse(BaseModel):
    avg_color: str
    pixel_count: int


class ColorDistribution(BaseModel):
    color: str
    count: int


class ViewportStatsResponse(BaseModel):
    dominant_color: str
    color_distribution: list[ColorDistribution]


class CountryStat(BaseModel):
    country: str
    avg_color: str
    pixel_count: int


class CountryRankingResponse(BaseModel):
    countries: list[CountryStat]


class RegionStatsResponse(BaseModel):
    avg_color: str
    pixel_count: int
    color_distribution: list[ColorDistribution]
