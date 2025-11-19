from decimal import Decimal, InvalidOperation

from flask import Blueprint, jsonify, request

from ..extensions import db
from ..models import Product

products_bp = Blueprint("products", __name__)


@products_bp.get("/")
def list_products():
    page = int(request.args.get("page", 1))
    per_page = min(int(request.args.get("per_page", 20)), 100)
    sku = request.args.get("sku")
    name = request.args.get("name")
    description = request.args.get("description")
    is_active = request.args.get("is_active")

    query = Product.query

    if sku:
        query = query.filter(Product.sku_normalized.contains(sku.lower()))
    if name:
        query = query.filter(Product.name.ilike(f"%{name}%"))
    if description:
        query = query.filter(Product.description.ilike(f"%{description}%"))
    if is_active is not None:
        if is_active.lower() == "true":
            query = query.filter(Product.is_active.is_(True))
        elif is_active.lower() == "false":
            query = query.filter(Product.is_active.is_(False))

    pagination = query.order_by(Product.created_at.desc()).paginate(page=page, per_page=per_page, error_out=False)
    return jsonify(
        {
            "items": [p.to_dict() for p in pagination.items],
            "total": pagination.total,
            "page": pagination.page,
            "pages": pagination.pages,
        }
    )


@products_bp.post("/")
def create_product():
    payload = request.get_json() or {}
    if not payload.get("sku"):
        return jsonify({"error": "SKU is required"}), 400
    product = Product(
        name=payload.get("name", ""),
        description=payload.get("description"),
        price=_parse_price(payload.get("price")),
        is_active=payload.get("is_active", True),
    )
    product.set_sku(payload["sku"])
    db.session.add(product)
    db.session.commit()
    return jsonify(product.to_dict()), 201


@products_bp.put("/<int:product_id>")
def update_product(product_id: int):
    product = Product.query.get_or_404(product_id)
    payload = request.get_json() or {}
    if "sku" in payload:
        if not payload["sku"]:
            return jsonify({"error": "SKU cannot be empty"}), 400
        product.set_sku(payload["sku"])
    for field in ["name", "description", "is_active"]:
        if field in payload:
            setattr(product, field, payload[field])
    if "price" in payload:
        product.price = _parse_price(payload["price"])
    db.session.commit()
    return jsonify(product.to_dict())


@products_bp.delete("/<int:product_id>")
def delete_product(product_id: int):
    product = Product.query.get_or_404(product_id)
    db.session.delete(product)
    db.session.commit()
    return ("", 204)


@products_bp.post("/bulk-delete")
def bulk_delete_products():
    deleted = db.session.query(Product).delete(synchronize_session=False)
    db.session.commit()
    return jsonify({"deleted": deleted})


def _parse_price(value):
    if value in (None, "", "null"):
        return None
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError):
        return None

